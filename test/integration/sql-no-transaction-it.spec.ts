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
import type { RunnerOption } from '../../src';
import { runner } from '../../src';
import {
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

const migrationName = '1000000000000_ConcurrentIndex';
const upSql =
  'CREATE INDEX CONCURRENTLY example_id_idx ON sql_no_transaction.example (id);';
const downSql = 'DROP INDEX CONCURRENTLY sql_no_transaction.example_id_idx;';
const modes = [
  ['legacySql', false],
  ['legacySql', true],
  ['sql', false],
  ['sql', true],
] as const;

describe.each(PG_VERSIONS)(
  'SQL noTransaction (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;
    let dir: string;
    let options: RunnerOption;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'sql_no_transaction'
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
      dir = await mkdtemp(join(tmpdir(), 'pgm-sql-no-transaction-'));
      await client.query('CREATE SCHEMA sql_no_transaction');
      await client.query(
        'CREATE TABLE sql_no_transaction.example (id integer)'
      );
      options = {
        direction: 'up',
        databaseUrl: container.getConnectionUri(),
        dir,
        schema: 'sql_no_transaction',
        migrationsSchema: 'sql_no_transaction',
        migrationsTable: 'pgmigrations',
        log: () => {},
      };
    });

    afterEach(async () => {
      try {
        await client.query('DROP SCHEMA IF EXISTS sql_no_transaction CASCADE');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    async function writeMigration(
      loader: 'legacySql' | 'sql',
      withDirective: boolean
    ) {
      const header = withDirective
        ? '\uFEFF-- description\r\n-- noTransaction\r\n'
        : '';
      if (loader === 'legacySql') {
        await writeFile(
          join(dir, `${migrationName}.sql`),
          `${header}-- Up Migration\n${upSql}\n-- Down Migration\n${downSql}\n`
        );
      } else {
        await writeFile(
          join(dir, `${migrationName}.up.sql`),
          `${header}${upSql}\n`
        );
        await writeFile(
          join(dir, `${migrationName}.down.sql`),
          `${withDirective ? '-- no transaction\n' : ''}${downSql}\n`
        );
      }
      options.migrationLoaderStrategies = [{ extensions: ['.sql'], loader }];
    }

    async function indexExists() {
      const { rows } = await client.query<{ present: boolean }>(
        "SELECT to_regclass('sql_no_transaction.example_id_idx') IS NOT NULL AS present"
      );
      return rows[0].present;
    }

    async function history() {
      return (
        await client.query(
          'SELECT name FROM sql_no_transaction.pgmigrations ORDER BY id'
        )
      ).rows;
    }

    it.each(modes)(
      'runs concurrent up/down with %s (singleTransaction: %s)',
      async (loader, singleTransaction) => {
        await writeMigration(loader, true);
        await runner({ ...options, singleTransaction });
        expect(await indexExists()).toBe(true);
        expect(await history()).toEqual([{ name: migrationName }]);

        await runner({ ...options, singleTransaction, direction: 'down' });
        expect(await indexExists()).toBe(false);
        expect(await history()).toEqual([]);
      }
    );

    it.each(modes)(
      'keeps the transaction without the directive with %s (singleTransaction: %s)',
      async (loader, singleTransaction) => {
        await writeMigration(loader, false);
        await expect(runner({ ...options, singleTransaction })).rejects.toThrow(
          'cannot run inside a transaction block'
        );
        expect(await indexExists()).toBe(false);
        expect(await history()).toEqual([]);

        await writeMigration(loader, true);
        await runner({ ...options, singleTransaction });
        await writeMigration(loader, false);
        await expect(
          runner({ ...options, singleTransaction, direction: 'down' })
        ).rejects.toThrow('cannot run inside a transaction block');
        expect(await indexExists()).toBe(true);
        expect(await history()).toEqual([{ name: migrationName }]);
      }
    );

    it.each(modes)(
      'leaves objects, history and locks unchanged during dryRun with %s (singleTransaction: %s)',
      async (loader, singleTransaction) => {
        await writeMigration(loader, true);
        const lockValue = 1091500;
        await client.query('SELECT pg_advisory_lock($1)', [lockValue]);
        try {
          await runner({
            ...options,
            singleTransaction,
            dryRun: true,
            lockValue,
          });
          expect(await indexExists()).toBe(false);
          expect(
            (
              await client.query(
                "SELECT to_regclass('sql_no_transaction.pgmigrations') AS relation"
              )
            ).rows
          ).toEqual([{ relation: null }]);
        } finally {
          await client.query('SELECT pg_advisory_unlock($1)', [lockValue]);
        }

        await runner({ ...options, singleTransaction });
        const recorded = await history();
        await client.query('SELECT pg_advisory_lock($1)', [lockValue]);
        try {
          await runner({
            ...options,
            singleTransaction,
            direction: 'down',
            dryRun: true,
            lockValue,
          });
          expect(await indexExists()).toBe(true);
          expect(await history()).toEqual(recorded);
        } finally {
          await client.query('SELECT pg_advisory_unlock($1)', [lockValue]);
        }
      }
    );
  }
);
