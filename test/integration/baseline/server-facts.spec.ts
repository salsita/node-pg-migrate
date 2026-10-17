import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readServerFacts } from '../../../src/baseline/io/server';
import type { ServerFacts } from '../../../src/baseline/types';
import { db } from '../../../src/db';
import {
  createDatabase,
  databaseUrl,
  INTEGRATION_TIMEOUT,
  loadSql,
  PG_VERSIONS,
} from '../utils';
import {
  migrateUp,
  queryRows,
  recordingLogger,
  serverVersion,
  workDir,
  writeSqlMigration,
} from './helpers';

/**
 * The server settings of the container, both different from the defaults
 * (100 and 0), so that they must be read from the server.
 */
const MAX_CONNECTIONS = 120;
const MAX_PREPARED_TRANSACTIONS = 5;

/**
 * Where the migrations table is, as `readServerFacts()` takes it.
 */
interface MigrationsTable {
  readonly migrationsSchema: string;
  readonly migrationsTable: string;
}

const DEFAULT_TABLE: MigrationsTable = {
  migrationsSchema: 'public',
  migrationsTable: 'pgmigrations',
};

describe.each(PG_VERSIONS)(
  'readServerFacts() (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (postgresVersion) => {
    let container: StartedPostgreSqlContainer;
    let server: Pick<
      ServerFacts,
      | 'isCockroach'
      | 'version'
      | 'versionNum'
      | 'maxConnections'
      | 'maxPreparedTransactions'
    >;

    beforeAll(async () => {
      container = await new PostgreSqlContainer(
        `postgres:${postgresVersion}-alpine`
      )
        .withUsername('ubuntu')
        .withPassword('ubuntu')
        .withDatabase('node_pg_migrate')
        .withCommand([
          'postgres',
          '-c',
          `max_connections=${MAX_CONNECTIONS}`,
          '-c',
          `max_prepared_transactions=${MAX_PREPARED_TRANSACTIONS}`,
        ])
        .start();
      const [versionNum] = await queryRows(
        container,
        container.getDatabase(),
        'SHOW server_version_num'
      );
      server = {
        isCockroach: false,
        version: await serverVersion(container),
        versionNum: Number(versionNum),
        maxConnections: MAX_CONNECTIONS,
        maxPreparedTransactions: MAX_PREPARED_TRANSACTIONS,
      };
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      await container?.stop();
    });

    /**
     * Reads the facts of a database through a client of its own.
     *
     * @param database The database.
     * @param table Where the migrations table is.
     *
     * @returns The facts.
     */
    async function factsOf(
      database: string,
      table: MigrationsTable = DEFAULT_TABLE
    ): Promise<ServerFacts> {
      const client = new pg.Client(databaseUrl(container, database));
      await client.connect();
      try {
        return await readServerFacts(db(client, recordingLogger()), table);
      } finally {
        await client.end();
      }
    }

    it('reads the server and a missing migrations table, and leaves the session as it was', async () => {
      await createDatabase(container, 'facts_blank');
      const client = new pg.Client(databaseUrl(container, 'facts_blank'));
      await client.connect();
      try {
        const facts = await readServerFacts(
          db(client, recordingLogger()),
          DEFAULT_TABLE
        );

        expect(facts).toEqual({
          ...server,
          migrationsTableExists: false,
          recordedMigrations: 0,
        });
        // Its transaction is over, and the session can still write.
        const { rows } = await client.query<{ pid: number }>(
          'SELECT pg_backend_pid() AS pid'
        );
        expect(
          await queryRows(
            container,
            'facts_blank',
            `SELECT state FROM pg_stat_activity WHERE pid = ${rows[0].pid}`
          )
        ).toEqual(['idle']);
        await client.query('CREATE TABLE written_after_facts (id integer)');
      } finally {
        await client.end();
      }
    });

    it('reads the history in the migrations table the runner created', async () => {
      await createDatabase(container, 'facts_default');
      const dir = await workDir();
      await writeSqlMigration(dir, '1_first', [
        'CREATE TABLE first_table (id integer);',
      ]);
      await writeSqlMigration(dir, '2_second', [
        'CREATE TABLE second_table (id integer);',
      ]);
      await migrateUp(databaseUrl(container, 'facts_default'), dir);

      expect(await factsOf('facts_default')).toEqual({
        ...server,
        migrationsTableExists: true,
        recordedMigrations: 2,
        migrationsSequence: { schema: 'public', name: 'pgmigrations_id_seq' },
      });
    });

    it('reads a custom migrations table whose schema and name need quoting', async () => {
      await createDatabase(container, 'facts_custom');
      await loadSql(
        container,
        'facts_custom',
        [
          'CREATE SCHEMA "Audit.Trail";',
          'CREATE TABLE "Audit.Trail"."Schema ""Migrations""" (id SERIAL PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL);',
          `INSERT INTO "Audit.Trail"."Schema ""Migrations""" (name, run_on) VALUES ('1_a', now()), ('2_b', now()), ('3_c', now());`,
          // Not the configured table: its row must not count.
          'CREATE TABLE public.pgmigrations (id SERIAL PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL);',
          `INSERT INTO public.pgmigrations (name, run_on) VALUES ('1_other', now());`,
        ].join('\n')
      );

      expect(
        await factsOf('facts_custom', {
          migrationsSchema: 'Audit.Trail',
          migrationsTable: 'Schema "Migrations"',
        })
      ).toEqual({
        ...server,
        migrationsTableExists: true,
        recordedMigrations: 3,
        migrationsSequence: {
          schema: 'Audit.Trail',
          name: 'Schema "Migrations"_id_seq',
        },
      });
    });

    it('reads the sequence a renamed migrations table really uses', async () => {
      await createDatabase(container, 'facts_renamed');
      await loadSql(
        container,
        'facts_renamed',
        [
          'CREATE TABLE public.old_history (id SERIAL PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL);',
          'ALTER TABLE public.old_history RENAME TO pgmigrations;',
        ].join('\n')
      );

      expect(await factsOf('facts_renamed')).toEqual({
        ...server,
        migrationsTableExists: true,
        recordedMigrations: 0,
        migrationsSequence: { schema: 'public', name: 'old_history_id_seq' },
      });
    });
  }
);
