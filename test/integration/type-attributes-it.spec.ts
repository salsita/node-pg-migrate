import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { runner } from '../../src';
import {
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

const migrationName = '1000000000000_type_attribute';

describe.each(PG_VERSIONS)(
  'conditional type attribute removal (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;
    let dir: string;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'type_attributes'
      );
      client = new pg.Client(container.getConnectionUri());
      await client.connect();
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      try {
        if (client) {
          await client.end();
        }
      } finally {
        if (container) {
          await container.stop();
        }
      }
    });

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'pgm-type-attributes-'));
      await client.query('CREATE SCHEMA type_attributes');
      await client.query('CREATE TYPE type_attributes.compfoo AS (a integer)');
    });

    afterEach(async () => {
      try {
        await client.query('DROP SCHEMA IF EXISTS type_attributes CASCADE');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    async function catalog() {
      return (
        await client.query<{ name: string }>(
          `SELECT a.attname AS name
          FROM pg_attribute a
          JOIN pg_type t ON t.typrelid = a.attrelid
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'type_attributes' AND t.typname = 'compfoo'
            AND a.attnum > 0 AND NOT a.attisdropped
          ORDER BY a.attnum`
        )
      ).rows;
    }

    async function history() {
      return (
        await client.query<{ name: string }>(
          'SELECT name FROM type_attributes.pgmigrations'
        )
      ).rows;
    }

    async function migrate(direction: 'up' | 'down') {
      return runner({
        databaseUrl: container.getConnectionUri(),
        dir,
        schema: 'type_attributes',
        migrationsSchema: 'type_attributes',
        migrationsTable: 'pgmigrations',
        count: 1,
        singleTransaction: true,
        direction,
        log: () => {},
      });
    }

    it.each([
      {
        state: 'present',
        setup: 'ALTER TYPE type_attributes.compfoo ADD ATTRIBUTE f3 integer',
      },
      { state: 'absent', setup: null },
    ])('drops an attribute that is $state with ifExists', async ({ setup }) => {
      if (setup) {
        await client.query(setup);
      }
      await writeFile(
        join(dir, `${migrationName}.mjs`),
        `export function up(pgm) {
          pgm.dropTypeAttribute(
            { schema: 'type_attributes', name: 'compfoo' },
            'f3',
            { ifExists: true }
          );
        }`
      );

      await migrate('up');

      expect(await catalog()).toEqual([{ name: 'a' }]);
      expect(await history()).toEqual([{ name: migrationName }]);
    });

    it('rejects a missing attribute without ifExists', async () => {
      await writeFile(
        join(dir, `${migrationName}.mjs`),
        `export function up(pgm) {
          pgm.dropTypeAttribute(
            { schema: 'type_attributes', name: 'compfoo' }, 'f3'
          );
        }`
      );

      await expect(migrate('up')).rejects.toMatchObject({ code: '42703' });

      expect(await catalog()).toEqual([{ name: 'a' }]);
      expect(await history()).toEqual([]);
    });

    it('rejects a missing type even with ifExists', async () => {
      await writeFile(
        join(dir, `${migrationName}.mjs`),
        `export function up(pgm) {
          pgm.dropTypeAttribute(
            { schema: 'type_attributes', name: 'missing_type' },
            'f3',
            { ifExists: true }
          );
        }`
      );

      await expect(migrate('up')).rejects.toMatchObject({
        code: '42P01',
        message: expect.stringContaining('missing_type'),
      });

      expect(await catalog()).toEqual([{ name: 'a' }]);
      expect(await history()).toEqual([]);
    });

    it.each([
      { state: 'present', beforeRollback: null },
      {
        state: 'already removed',
        beforeRollback: 'ALTER TYPE type_attributes.compfoo DROP ATTRIBUTE f3',
      },
    ])(
      'automatically rolls back an attribute that is $state and its history',
      async ({ beforeRollback }) => {
        await writeFile(
          join(dir, `${migrationName}.mjs`),
          `export function up(pgm) {
            pgm.addTypeAttribute(
              { schema: 'type_attributes', name: 'compfoo' },
              'f3',
              'integer',
              { ifExists: true }
            );
          }`
        );
        await migrate('up');
        expect(await catalog()).toEqual([{ name: 'a' }, { name: 'f3' }]);
        expect(await history()).toEqual([{ name: migrationName }]);

        if (beforeRollback) {
          await client.query(beforeRollback);
        }

        await migrate('down');

        expect(await catalog()).toEqual([{ name: 'a' }]);
        expect(await history()).toEqual([]);
      }
    );
  }
);
