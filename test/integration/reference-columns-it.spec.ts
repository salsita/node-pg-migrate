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

const migrationName = '1000000000000_explicit_references';

describe.each(PG_VERSIONS)(
  'explicit reference columns (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;
    let dir: string;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'reference_columns'
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
      dir = await mkdtemp(join(tmpdir(), 'pgm-reference-columns-'));
      await client.query(`
      CREATE SCHEMA "target.schema";
      CREATE SCHEMA reference_columns;
      CREATE TABLE "target.schema"."parent""表" (
        id integer PRIMARY KEY,
        "code-key" text UNIQUE,
        "tenant.id" integer,
        "code""pair" text,
        UNIQUE ("tenant.id", "code""pair")
      );
      INSERT INTO "target.schema"."parent""表" VALUES
        (1, 'first', 10, 'a'), (2, 'second', 20, 'b');
      CREATE TABLE reference_columns.add_columns (id integer PRIMARY KEY);
      CREATE TABLE reference_columns.add_constraint (tenant integer, code text);
    `);
    });

    afterEach(async () => {
      try {
        await client.query(
          'DROP SCHEMA IF EXISTS reference_columns CASCADE; DROP SCHEMA IF EXISTS "target.schema" CASCADE;'
        );
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    async function migrate(direction: 'up' | 'down') {
      return runner({
        databaseUrl: container.getConnectionUri(),
        dir,
        schema: 'reference_columns',
        migrationsSchema: 'reference_columns',
        migrationsTable: 'pgmigrations',
        count: 1,
        direction,
        singleTransaction: true,
        log: () => {},
      });
    }

    async function history() {
      return (
        await client.query<{ name: string }>(
          'SELECT name FROM reference_columns.pgmigrations'
        )
      ).rows;
    }

    it('enforces nonprimary unique keys and composite references across schemas, then reverses every operation', async () => {
      await writeFile(
        join(dir, `${migrationName}.mjs`),
        `
      const parent = { schema: 'target.schema', name: 'parent"表' };
      const table = (name) => ({ schema: 'reference_columns', name });
      export function up(pgm) {
        pgm.createTable(table('created.child'), {
          code: {
            type: 'text', references: { ...parent, columns: 'code-key' },
            referencesConstraintName: 'single_fk',
            referencesConstraintComment: 'references a unique key',
            onUpdate: 'CASCADE', onDelete: 'CASCADE',
          },
          tenant: 'integer', pair: 'text',
        }, {
          constraints: { foreignKeys: {
            columns: ['tenant', 'pair'],
            references: { ...parent, columns: ['tenant.id', 'code"pair'] },
            referencesConstraintName: 'composite_fk',
          } },
        });
        pgm.addColumns(table('add_columns'), {
          code: { type: 'text', references: { ...parent, columns: ['code-key'] } },
        });
        pgm.addConstraint(table('add_constraint'), 'added_fk', {
          foreignKeys: {
            columns: ['tenant', 'code'],
            references: { ...parent, columns: ['tenant.id', 'code"pair'] },
          },
        });
      }
    `
      );

      await migrate('up');
      expect(await history()).toEqual([{ name: migrationName }]);
      const catalog = await client.query<{
        table_name: string;
        target_schema: string;
        target_name: string;
        columns: string[];
      }>(`
      SELECT child.relname AS table_name, ns.nspname AS target_schema, target.relname AS target_name,
        ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum, position)
          JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum
          ORDER BY k.position) AS columns
      FROM pg_constraint c
      JOIN pg_class child ON child.oid = c.conrelid
      JOIN pg_class target ON target.oid = c.confrelid
      JOIN pg_namespace ns ON ns.oid = target.relnamespace
      WHERE c.contype = 'f' AND child.relnamespace = 'reference_columns'::regnamespace
      ORDER BY child.relname, c.conname
    `);
      expect(catalog.rows).toEqual([
        {
          table_name: 'add_columns',
          target_schema: 'target.schema',
          target_name: 'parent"表',
          columns: ['code-key'],
        },
        {
          table_name: 'add_constraint',
          target_schema: 'target.schema',
          target_name: 'parent"表',
          columns: ['tenant.id', 'code"pair'],
        },
        {
          table_name: 'created.child',
          target_schema: 'target.schema',
          target_name: 'parent"表',
          columns: ['tenant.id', 'code"pair'],
        },
        {
          table_name: 'created.child',
          target_schema: 'target.schema',
          target_name: 'parent"表',
          columns: ['code-key'],
        },
      ]);
      expect(
        (
          await client.query<{ comment: string }>(`
      SELECT obj_description(oid, 'pg_constraint') AS comment FROM pg_constraint
      WHERE conname = 'single_fk' AND conrelid = 'reference_columns."created.child"'::regclass
    `)
        ).rows
      ).toEqual([{ comment: 'references a unique key' }]);

      await client.query(`
      INSERT INTO reference_columns."created.child" VALUES ('first', 10, 'a');
      INSERT INTO reference_columns.add_columns VALUES (1, 'second');
      INSERT INTO reference_columns.add_constraint VALUES (20, 'b');
    `);
      await expect(
        client.query(
          `INSERT INTO reference_columns."created.child" VALUES ('missing', 10, 'a')`
        )
      ).rejects.toMatchObject({ code: '23503', constraint: 'single_fk' });
      await expect(
        client.query(
          `INSERT INTO reference_columns."created.child" VALUES ('first', 10, 'b')`
        )
      ).rejects.toMatchObject({ code: '23503', constraint: 'composite_fk' });
      await expect(
        client.query(
          `INSERT INTO reference_columns.add_columns VALUES (2, 'missing')`
        )
      ).rejects.toMatchObject({ code: '23503' });
      await expect(
        client.query(
          `INSERT INTO reference_columns.add_constraint VALUES (10, 'b')`
        )
      ).rejects.toMatchObject({ code: '23503', constraint: 'added_fk' });
      await client.query(
        `UPDATE "target.schema"."parent""表" SET "code-key" = 'updated' WHERE id = 1`
      );
      expect(
        (
          await client.query<{ code: string }>(
            'SELECT code FROM reference_columns."created.child"'
          )
        ).rows
      ).toEqual([{ code: 'updated' }]);

      await migrate('down');
      expect(await history()).toEqual([]);
      expect(
        (
          await client.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'reference_columns' ORDER BY table_name
    `)
        ).rows
      ).toEqual([
        { table_name: 'add_columns' },
        { table_name: 'add_constraint' },
        { table_name: 'pgmigrations' },
      ]);
      expect(
        (
          await client.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'reference_columns' AND table_name = 'add_columns'
    `)
        ).rows
      ).toEqual([{ column_name: 'id' }]);
      expect(
        (
          await client.query<{ count: number }>(`
      SELECT count(*)::int AS count FROM pg_constraint
      WHERE contype = 'f' AND connamespace = 'reference_columns'::regnamespace
    `)
        ).rows
      ).toEqual([{ count: 0 }]);
      await client.query(
        `INSERT INTO reference_columns.add_constraint VALUES (10, 'b')`
      );
    });
  }
);
