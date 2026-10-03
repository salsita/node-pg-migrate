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

const grantMigration = '1000000000000_grant_sequence_privileges';
const revokeMigration = '1000000000001_revoke_sequence_grant_option';

describe.each(PG_VERSIONS)(
  'sequence privileges (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;
    let reader: pg.Client;
    let delegate: pg.Client;
    let dir: string;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'sequence_privileges'
      );
      client = new pg.Client(container.getConnectionUri());
      await client.connect();
      await client.query(`
        CREATE ROLE sequence_reader LOGIN PASSWORD 'sequence_reader' NOSUPERUSER;
        CREATE ROLE sequence_delegate LOGIN PASSWORD 'sequence_delegate' NOSUPERUSER
      `);
      const readerUri = new URL(container.getConnectionUri());
      readerUri.username = 'sequence_reader';
      readerUri.password = 'sequence_reader';
      reader = new pg.Client(readerUri.toString());
      await reader.connect();
      const delegateUri = new URL(container.getConnectionUri());
      delegateUri.username = 'sequence_delegate';
      delegateUri.password = 'sequence_delegate';
      delegate = new pg.Client(delegateUri.toString());
      await delegate.connect();
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      try {
        if (delegate) {
          await delegate.end();
        }
        if (reader) {
          await reader.end();
        }
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
      dir = await mkdtemp(join(tmpdir(), 'pgm-sequence-privileges-'));
      await client.query(`
        CREATE SCHEMA sequence_privileges;
        CREATE SCHEMA other_sequences;
        CREATE TABLE sequence_privileges.records (id serial, value text);
        CREATE SEQUENCE sequence_privileges.standalone;
        CREATE SEQUENCE other_sequences.standalone;
        GRANT USAGE ON SCHEMA sequence_privileges, other_sequences
          TO sequence_reader, sequence_delegate;
        GRANT INSERT ON sequence_privileges.records TO sequence_reader
      `);
    });

    afterEach(async () => {
      try {
        await client.query(`
          DROP SCHEMA IF EXISTS sequence_privileges CASCADE;
          DROP SCHEMA IF EXISTS other_sequences CASCADE
        `);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    async function privileges(role: string, sequence: string) {
      return (
        await client.query<{
          usage: boolean;
          select: boolean;
          update: boolean;
          grantOption: boolean;
        }>(
          `SELECT has_sequence_privilege($1, $2, 'USAGE') AS usage,
            has_sequence_privilege($1, $2, 'SELECT') AS select,
            has_sequence_privilege($1, $2, 'UPDATE') AS update,
            has_sequence_privilege($1, $2, 'USAGE WITH GRANT OPTION') AS "grantOption"`,
          [role, sequence]
        )
      ).rows[0];
    }

    async function migrate(direction: 'up' | 'down') {
      return runner({
        databaseUrl: container.getConnectionUri(),
        dir,
        schema: 'sequence_privileges',
        migrationsSchema: 'sequence_privileges',
        migrationsTable: 'pgmigrations',
        count: 1,
        singleTransaction: true,
        direction,
        log: () => {},
      });
    }

    it('grants only sequence usage for serial inserts and revokes it on automatic down', async () => {
      await writeFile(
        join(dir, `${grantMigration}.mjs`),
        `export function up(pgm) {
          pgm.grantOnSequences({
            sequences: { schema: 'sequence_privileges', name: 'records_id_seq' },
            privileges: 'USAGE', roles: 'sequence_reader'
          });
        }`
      );

      const insert =
        "INSERT INTO sequence_privileges.records (value) VALUES ('record')";
      await expect(reader.query(insert)).rejects.toMatchObject({
        code: '42501',
      });

      await migrate('up');
      expect(
        await privileges(
          'sequence_reader',
          'sequence_privileges.records_id_seq'
        )
      ).toEqual({
        usage: true,
        select: false,
        update: false,
        grantOption: false,
      });
      await reader.query(insert);
      await expect(
        reader.query(
          'SELECT last_value FROM sequence_privileges.records_id_seq'
        )
      ).rejects.toMatchObject({ code: '42501' });
      await expect(
        reader.query("SELECT setval('sequence_privileges.records_id_seq', 100)")
      ).rejects.toMatchObject({ code: '42501' });

      await migrate('down');
      expect(
        await privileges(
          'sequence_reader',
          'sequence_privileges.records_id_seq'
        )
      ).toEqual({
        usage: false,
        select: false,
        update: false,
        grantOption: false,
      });
      await expect(reader.query(insert)).rejects.toMatchObject({
        code: '42501',
      });
      expect(
        (
          await client.query(
            'SELECT id, value FROM sequence_privileges.records'
          )
        ).rows
      ).toEqual([{ id: 1, value: 'record' }]);
      expect(
        (
          await client.query(
            'SELECT name FROM sequence_privileges.pgmigrations'
          )
        ).rows
      ).toEqual([]);
    });

    it('limits ALL to existing sequences in the selected schema and reverses it for every role', async () => {
      await client.query(
        'GRANT SELECT ON SEQUENCE other_sequences.standalone TO sequence_reader'
      );
      const outsidePrivileges = await privileges(
        'sequence_reader',
        'other_sequences.standalone'
      );
      await writeFile(
        join(dir, `${grantMigration}.mjs`),
        `export function up(pgm) {
          pgm.grantOnSequences({
            sequences: 'ALL', schema: 'sequence_privileges',
            privileges: 'ALL', roles: ['sequence_reader', 'sequence_delegate']
          });
        }`
      );

      await migrate('up');
      for (const role of ['sequence_reader', 'sequence_delegate']) {
        for (const sequence of ['records_id_seq', 'standalone']) {
          expect(
            await privileges(role, `sequence_privileges.${sequence}`)
          ).toEqual({
            usage: true,
            select: true,
            update: true,
            grantOption: false,
          });
        }
      }
      await reader.query(
        "SELECT setval('sequence_privileges.standalone', 100)"
      );
      await client.query('CREATE SEQUENCE sequence_privileges.created_later');
      await expect(
        reader.query("SELECT nextval('sequence_privileges.created_later')")
      ).rejects.toMatchObject({ code: '42501' });
      await client.query(
        'GRANT USAGE ON SEQUENCE sequence_privileges.created_later TO sequence_reader'
      );
      await reader.query("SELECT nextval('sequence_privileges.created_later')");

      await migrate('down');
      await expect(
        reader.query("SELECT nextval('sequence_privileges.created_later')")
      ).rejects.toMatchObject({ code: '42501' });
      for (const role of ['sequence_reader', 'sequence_delegate']) {
        for (const sequence of ['records_id_seq', 'standalone']) {
          expect(
            await privileges(role, `sequence_privileges.${sequence}`)
          ).toEqual({
            usage: false,
            select: false,
            update: false,
            grantOption: false,
          });
        }
      }
      expect(
        await privileges('sequence_reader', 'other_sequences.standalone')
      ).toEqual(outsidePrivileges);
    });

    it('revokes a grant option with CASCADE while retaining the original usage privilege', async () => {
      await writeFile(
        join(dir, `${grantMigration}.mjs`),
        `export function up(pgm) {
          pgm.grantOnSequences({
            sequences: { schema: 'sequence_privileges', name: 'standalone' },
            privileges: 'USAGE', roles: 'sequence_reader', withGrantOption: true
          });
        }`
      );
      await writeFile(
        join(dir, `${revokeMigration}.mjs`),
        `export function up(pgm) {
          pgm.revokeOnSequences({
            sequences: { schema: 'sequence_privileges', name: 'standalone' },
            privileges: 'USAGE', roles: 'sequence_reader',
            onlyGrantOption: true, cascade: true
          });
        }`
      );

      await migrate('up');
      expect(
        await privileges('sequence_reader', 'sequence_privileges.standalone')
      ).toEqual({
        usage: true,
        select: false,
        update: false,
        grantOption: true,
      });
      await reader.query(
        'GRANT USAGE ON SEQUENCE sequence_privileges.standalone TO sequence_delegate'
      );
      await delegate.query("SELECT nextval('sequence_privileges.standalone')");

      await migrate('up');
      expect(
        await privileges('sequence_reader', 'sequence_privileges.standalone')
      ).toEqual({
        usage: true,
        select: false,
        update: false,
        grantOption: false,
      });
      await reader.query("SELECT nextval('sequence_privileges.standalone')");
      await expect(
        delegate.query("SELECT nextval('sequence_privileges.standalone')")
      ).rejects.toMatchObject({ code: '42501' });
    });
  }
);
