import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
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
import { MigrationBuilder, PgLiteral } from '../../src';
import { db } from '../../src/db';
import { quote } from '../../src/utils/quote';
import {
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

const operations = [
  [
    'renameTable',
    'CREATE TABLE',
    ' (value integer)',
    'pg_class',
    'relname',
    'relnamespace',
  ],
  [
    'renameType',
    'CREATE TYPE',
    " AS ENUM ('active')",
    'pg_type',
    'typname',
    'typnamespace',
  ],
  [
    'renameDomain',
    'CREATE DOMAIN',
    ' AS integer',
    'pg_type',
    'typname',
    'typnamespace',
  ],
  [
    'renameView',
    'CREATE VIEW',
    ' AS SELECT 1 AS value',
    'pg_class',
    'relname',
    'relnamespace',
  ],
  [
    'renameMaterializedView',
    'CREATE MATERIALIZED VIEW',
    ' AS SELECT 1 AS value',
    'pg_class',
    'relname',
    'relnamespace',
  ],
  [
    'renameSequence',
    'CREATE SEQUENCE',
    '',
    'pg_class',
    'relname',
    'relnamespace',
  ],
  ['renameIndex', 'CREATE INDEX', '', 'pg_class', 'relname', 'relnamespace'],
] as const;

type RenameOperation = (typeof operations)[number][0];

const scenarios: Array<{
  title: string;
  original: string;
  final: string;
  qualified: boolean;
  migrate: (pgm: MigrationBuilder, operation: RenameOperation) => void;
}> = [
  {
    title: 'rendered schema equality and empty destination in a rename chain',
    original: 'old_name',
    final: 'new_name',
    qualified: true,
    migrate: (pgm, operation) => {
      pgm[operation](
        { schema: 'appSchema', name: 'oldName' },
        { schema: 'app_schema', name: 'middleName' }
      );
      pgm[operation](
        { schema: 'app_schema', name: 'middleName' },
        { schema: '', name: 'newName' }
      );
    },
  },
  {
    title: 'empty and omitted schemas in both argument orders',
    original: 'old_name',
    final: 'new_name',
    qualified: false,
    migrate: (pgm, operation) => {
      pgm[operation]({ schema: '', name: 'oldName' }, { name: 'middleName' });
      pgm[operation]({ name: 'middleName' }, { schema: '', name: 'newName' });
    },
  },
  {
    title: 'quoted raw destination with dots, escaped quotes and whitespace',
    original: 'old_name',
    final: 'New.Name"Quoted',
    qualified: true,
    migrate: (pgm, operation) => {
      pgm[operation](
        { schema: 'appSchema', name: 'oldName' },
        PgLiteral.create(' \t"New.Name""Quoted"\n')
      );
    },
  },
  {
    title: 'unquoted raw destination preserves PostgreSQL case folding',
    original: 'old_name',
    final: 'newname',
    qualified: true,
    migrate: (pgm, operation) => {
      pgm[operation](
        { schema: 'appSchema', name: 'oldName' },
        PgLiteral.create('NewName')
      );
    },
  },
  {
    title: 'unqualified raw source during automatic reversal',
    original: 'oldname',
    final: 'new_name',
    qualified: false,
    migrate: (pgm, operation) => {
      pgm[operation](PgLiteral.create('OldName'), 'newName');
    },
  },
];

describe.each(PG_VERSIONS)(
  'schema-aware renames (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'rename_schemas'
      );
      client = new pg.Client(container.getConnectionUri());
      await client.connect();
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      if (client) {
        await client.end();
      }
      if (container) {
        await container.stop();
      }
    });

    beforeEach(async () => {
      await client.query('BEGIN');
      await client.query(
        'CREATE SCHEMA app_schema; CREATE SCHEMA decoy_schema'
      );
    });

    afterEach(async () => {
      await client.query('ROLLBACK');
    });

    describe.each(operations)(
      '%s',
      (operation, create, definition, catalog, nameColumn, namespaceColumn) => {
        it.each(scenarios)(
          '$title',
          async ({ original, final, qualified, migrate }) => {
            // With a qualified source, an accidentally unqualified rollback would hit
            // the decoy first. Unqualified inputs deliberately use the session schema.
            await client.query(
              qualified
                ? 'SET LOCAL search_path TO decoy_schema, app_schema'
                : 'SET LOCAL search_path TO app_schema, decoy_schema'
            );

            async function createObject(schema: string, name: string) {
              if (operation === 'renameIndex') {
                await client.query(
                  `CREATE TABLE IF NOT EXISTS ${quote(schema)}.indexed_table (value integer)`
                );
                await client.query(
                  `CREATE INDEX ${quote(name)} ON ${quote(schema)}.indexed_table (value)`
                );
              } else {
                await client.query(
                  `${create} ${quote(schema)}.${quote(name)}${definition}`
                );
              }
            }

            async function objects(schema: string) {
              const result = await client.query<{ name: string; oid: string }>(
                `SELECT o.${nameColumn} AS name, o.oid::text AS oid FROM ${catalog} o
           JOIN pg_namespace n ON n.oid = o.${namespaceColumn}
           WHERE n.nspname = $1 AND o.${nameColumn} = ANY($2::text[]) ORDER BY name`,
                [schema, [original, 'middle_name', final]]
              );
              return result.rows;
            }

            await createObject('app_schema', original);
            await createObject('decoy_schema', original);
            await createObject('decoy_schema', 'middle_name');
            await createObject('decoy_schema', final);
            const before = await objects('app_schema');
            const decoys = await objects('decoy_schema');
            expect(before).toHaveLength(1);
            expect(decoys).toHaveLength(3);

            const up = new MigrationBuilder(
              db(client),
              undefined,
              true,
              console
            );
            migrate(up, operation);
            for (const sql of up.getSqlSteps()) {
              await client.query(sql);
            }
            expect(await objects('app_schema')).toEqual([
              { name: final, oid: before[0].oid },
            ]);
            expect(await objects('decoy_schema')).toEqual(decoys);

            const down = new MigrationBuilder(
              db(client),
              undefined,
              true,
              console
            );
            down.enableReverseMode();
            migrate(down, operation);
            for (const sql of down.getSqlSteps()) {
              await client.query(sql);
            }
            expect(await objects('app_schema')).toEqual(before);
            expect(await objects('decoy_schema')).toEqual(decoys);
          }
        );
      }
    );
  }
);
