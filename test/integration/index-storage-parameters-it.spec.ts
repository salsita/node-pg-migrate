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
import type { CreateIndexOptions } from '../../src';
import { runner } from '../../src';
import {
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

const migrationName = '1000000000000_index_storage_parameters';

interface IndexTestCase {
  title: string;
  operation: 'createIndex' | 'addIndex';
  column: string;
  options: CreateIndexOptions;
  noTransaction: boolean;
  method: string;
  parameters: string[];
  totalColumns: number;
  predicate: string | null;
}

describe.each(PG_VERSIONS)(
  'index storage parameters (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;
    let dir: string;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'index_storage_parameters'
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
      dir = await mkdtemp(join(tmpdir(), 'pgm-index-storage-parameters-'));
      await client.query('CREATE SCHEMA index_storage_parameters');
      await client.query(`CREATE TABLE index_storage_parameters.records (
        id integer, payload text, tags text[], location point
      )`);
      await client.query(`INSERT INTO index_storage_parameters.records VALUES
        (1, 'first', ARRAY['a'], point(1, 2)),
        (2, 'second', ARRAY['b'], point(3, 4))`);
    });

    afterEach(async () => {
      try {
        await client.query(
          'DROP SCHEMA IF EXISTS index_storage_parameters CASCADE'
        );
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    async function catalog() {
      return (
        await client.query<{
          name: string;
          method: string;
          parameters: string[];
          valid: boolean;
          key_columns: number;
          total_columns: number;
          predicate: string | null;
        }>(
          `SELECT c.relname AS name, am.amname AS method,
            c.reloptions AS parameters, i.indisvalid AS valid,
            i.indnkeyatts AS key_columns, i.indnatts AS total_columns,
            pg_get_expr(i.indpred, i.indrelid) AS predicate
          FROM pg_index i
          JOIN pg_class c ON c.oid = i.indexrelid
          JOIN pg_am am ON am.oid = c.relam
          WHERE i.indrelid = 'index_storage_parameters.records'::regclass`
        )
      ).rows;
    }

    async function history() {
      return (
        await client.query<{ name: string }>(
          'SELECT name FROM index_storage_parameters.pgmigrations'
        )
      ).rows;
    }

    async function migrate(direction: 'up' | 'down') {
      return runner({
        databaseUrl: container.getConnectionUri(),
        dir,
        schema: 'public',
        migrationsSchema: 'index_storage_parameters',
        migrationsTable: 'pgmigrations',
        count: 1,
        singleTransaction: true,
        direction,
        log: () => {},
      });
    }

    it.each([
      {
        title:
          'numeric and boolean parameters on a partial covering B-tree index',
        operation: 'createIndex',
        column: 'id',
        options: {
          include: 'payload',
          where: 'id > 0',
          storageParameters: { fillfactor: 70, deduplicate_items: true },
        },
        noTransaction: false,
        method: 'btree',
        parameters: ['fillfactor=70', 'deduplicate_items=true'],
        totalColumns: 2,
        predicate: '(id > 0)',
      },
      {
        title: 'a false boolean parameter on a GIN index through addIndex',
        operation: 'addIndex',
        column: 'tags',
        options: { method: 'gin', storageParameters: { fastupdate: false } },
        noTransaction: false,
        method: 'gin',
        parameters: ['fastupdate=false'],
        totalColumns: 1,
        predicate: null,
      },
      {
        title: 'a string parameter on a GiST index',
        operation: 'createIndex',
        column: 'location',
        options: { method: 'gist', storageParameters: { buffering: 'off' } },
        noTransaction: false,
        method: 'gist',
        parameters: ['buffering=off'],
        totalColumns: 1,
        predicate: null,
      },
      {
        title: 'numeric and true boolean parameters on a BRIN index',
        operation: 'createIndex',
        column: 'id',
        options: {
          method: 'brin',
          storageParameters: { pages_per_range: 32, autosummarize: true },
        },
        noTransaction: false,
        method: 'brin',
        parameters: ['pages_per_range=32', 'autosummarize=true'],
        totalColumns: 1,
        predicate: null,
      },
      {
        title:
          'numeric and false boolean parameters on a BRIN index through addIndex',
        operation: 'addIndex',
        column: 'id',
        options: {
          method: 'brin',
          storageParameters: { pages_per_range: 64, autosummarize: false },
        },
        noTransaction: false,
        method: 'brin',
        parameters: ['pages_per_range=64', 'autosummarize=false'],
        totalColumns: 1,
        predicate: null,
      },
      {
        title: 'parameters on a concurrent B-tree index outside a transaction',
        operation: 'createIndex',
        column: 'id',
        options: { concurrently: true, storageParameters: { fillfactor: 80 } },
        noTransaction: true,
        method: 'btree',
        parameters: ['fillfactor=80'],
        totalColumns: 1,
        predicate: null,
      },
    ] satisfies IndexTestCase[])(
      'creates and automatically reverses $title',
      async ({
        operation,
        column,
        options,
        noTransaction,
        method,
        parameters,
        totalColumns,
        predicate,
      }) => {
        await writeFile(
          join(dir, `${migrationName}.mjs`),
          `export function up(pgm) {
            ${noTransaction ? 'pgm.noTransaction();' : ''}
            pgm.${operation}(
              { schema: 'index_storage_parameters', name: 'records' },
              '${column}',
              ${JSON.stringify({ name: 'records_storage_index', ...options })}
            );
          }`
        );
        expect(await catalog()).toEqual([]);

        await migrate('up');
        expect(await catalog()).toEqual([
          {
            name: 'records_storage_index',
            method,
            parameters,
            valid: true,
            key_columns: 1,
            total_columns: totalColumns,
            predicate,
          },
        ]);
        expect(await history()).toEqual([{ name: migrationName }]);

        await migrate('down');
        expect(await catalog()).toEqual([]);
        expect(await history()).toEqual([]);
        expect(
          (
            await client.query(
              'SELECT id, payload, tags, location::text AS location FROM index_storage_parameters.records ORDER BY id'
            )
          ).rows
        ).toEqual([
          { id: 1, payload: 'first', tags: ['a'], location: '(1,2)' },
          { id: 2, payload: 'second', tags: ['b'], location: '(3,4)' },
        ]);
      }
    );
  }
);
