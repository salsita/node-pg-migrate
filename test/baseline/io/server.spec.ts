import { describe, expect, it } from 'vitest';
import { readServerFacts } from '../../../src/baseline/io/server';
import { messageOf, rejectionOf } from '../helpers';
import type { FakeServerOptions, FakeTable } from './fakeServer';
import { FakeServer } from './fakeServer';

/**
 * A PostgreSQL 18.6 server as the official Debian-based image reports it.
 */
const POSTGRES_18: FakeServerOptions = {
  version:
    'PostgreSQL 18.6 (Debian 18.6-1.pgdg13+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit',
  settings: {
    server_version: '18.6 (Debian 18.6-1.pgdg13+1)',
    server_version_num: '180006',
    max_connections: '250',
    max_prepared_transactions: '5',
    search_path: '"$user", public',
  },
};

const MIGRATIONS_TABLE: FakeTable = {
  schema: 'public',
  name: 'pgmigrations',
  rows: 3,
  serialSequence: 'public.pgmigrations_id_seq',
};

const DEFAULT_TABLE = {
  migrationsSchema: 'public',
  migrationsTable: 'pgmigrations',
};

/**
 * Checks the statements of a normal run: `SELECT version()` first, then a
 * read-only transaction that is rolled back, at most 6 statements in all.
 */
function expectReadOnlyRun(statements: ReadonlyArray<string>): void {
  expect(statements.length).toBeGreaterThanOrEqual(3);
  expect(statements.length).toBeLessThanOrEqual(6);
  expect(statements[0]).toMatch(/\bversion\s*\(\s*\)/i);
  expect(statements[0]).not.toMatch(/\b(?:BEGIN|START)\b/i);
  expect(statements[1]).toMatch(
    /^\s*(?:BEGIN|START\s+TRANSACTION)\b[^;]*\bREAD\s+ONLY\b/i
  );
  expect(statements.at(-1)).toMatch(/^\s*ROLLBACK\b/i);
  expect(
    statements
      .slice(2, -1)
      .filter((statement) =>
        /^\s*(?:BEGIN|START|COMMIT|END|ROLLBACK|ABORT)\b/i.test(statement)
      )
  ).toEqual([]);
}

describe('readServerFacts', () => {
  it('reads the version, the lock table settings and the migration history', async () => {
    const server = new FakeServer({
      ...POSTGRES_18,
      tables: [MIGRATIONS_TABLE],
    });

    await expect(readServerFacts(server.db, DEFAULT_TABLE)).resolves.toEqual({
      isCockroach: false,
      version: '18.6',
      versionNum: 180_006,
      maxConnections: 250,
      maxPreparedTransactions: 5,
      migrationsTableExists: true,
      recordedMigrations: 3,
      migrationsSequence: { schema: 'public', name: 'pgmigrations_id_seq' },
    });
    expectReadOnlyRun(server.statements);
  });

  it('reports a missing migrations table without a history', async () => {
    const server = new FakeServer(POSTGRES_18);
    const facts = await readServerFacts(server.db, DEFAULT_TABLE);

    expect(facts).toMatchObject({
      isCockroach: false,
      version: '18.6',
      versionNum: 180_006,
      maxConnections: 250,
      maxPreparedTransactions: 5,
      migrationsTableExists: false,
      recordedMigrations: 0,
    });
    expect(facts.migrationsSequence).toBeUndefined();
    expectReadOnlyRun(server.statements);
  });

  it('reads another server version', async () => {
    const server = new FakeServer({
      version:
        'PostgreSQL 14.24 on x86_64-pc-linux-musl, compiled by gcc (Alpine 14.2.0) 14.2.0, 64-bit',
      settings: {
        server_version: '14.24',
        server_version_num: '140024',
        max_connections: '100',
        max_prepared_transactions: '0',
        search_path: '"$user", public',
      },
    });

    await expect(
      readServerFacts(server.db, DEFAULT_TABLE)
    ).resolves.toMatchObject({
      isCockroach: false,
      version: '14.24',
      versionNum: 140_024,
      maxConnections: 100,
      maxPreparedTransactions: 0,
    });
  });

  it('finds the migrations table by its exact schema and name', async () => {
    const server = new FakeServer({
      ...POSTGRES_18,
      tables: [
        {
          schema: 'App Schema',
          name: 'PgMigrations',
          rows: 2,
          serialSequence: '"App Schema"."PgMigrations_id_seq"',
        },
        {
          schema: 'app schema',
          name: 'pgmigrations',
          rows: 9,
          serialSequence: '"app schema".pgmigrations_id_seq',
        },
        MIGRATIONS_TABLE,
      ],
    });

    await expect(
      readServerFacts(server.db, {
        migrationsSchema: 'App Schema',
        migrationsTable: 'PgMigrations',
      })
    ).resolves.toMatchObject({
      migrationsTableExists: true,
      recordedMigrations: 2,
      migrationsSequence: { schema: 'App Schema', name: 'PgMigrations_id_seq' },
    });
    expectReadOnlyRun(server.statements);
  });

  it('does not take a table whose name only folds to the configured one', async () => {
    const server = new FakeServer({
      ...POSTGRES_18,
      tables: [
        {
          schema: 'public',
          name: 'PgMigrations',
          rows: 2,
          serialSequence: 'public."PgMigrations_id_seq"',
        },
        { ...MIGRATIONS_TABLE, rows: 7 },
      ],
    });

    await expect(
      readServerFacts(server.db, {
        migrationsSchema: 'public',
        migrationsTable: 'PgMigrations',
      })
    ).resolves.toMatchObject({
      migrationsTableExists: true,
      recordedMigrations: 2,
      migrationsSequence: { schema: 'public', name: 'PgMigrations_id_seq' },
    });
  });

  it('gives no sequence when the id column has none', async () => {
    const server = new FakeServer({
      ...POSTGRES_18,
      tables: [{ schema: 'public', name: 'pgmigrations', rows: 1 }],
    });
    const facts = await readServerFacts(server.db, DEFAULT_TABLE);

    expect(facts).toMatchObject({
      migrationsTableExists: true,
      recordedMigrations: 1,
    });
    expect(facts.migrationsSequence).toBeUndefined();
  });

  it('stops after SELECT version() on CockroachDB, without a transaction', async () => {
    const server = new FakeServer({
      version:
        'CockroachDB CCL v25.3.5 (x86_64-pc-linux-gnu, built 2025/10/20 17:49:29, go1.23.12 X:nocoverageredesign)',
      settings: {},
    });

    await expect(
      readServerFacts(server.db, DEFAULT_TABLE)
    ).resolves.toMatchObject({ isCockroach: true });
    expect(server.statements).toHaveLength(1);
    expect(server.statements[0]).toMatch(/\bversion\s*\(\s*\)/i);
  });

  it('rolls the transaction back when a query fails', async () => {
    const server = new FakeServer({
      ...POSTGRES_18,
      tables: [MIGRATIONS_TABLE],
      failAfterBegin: true,
    });
    const error = await rejectionOf(readServerFacts(server.db, DEFAULT_TABLE));
    const cause = error instanceof Error ? error.cause : undefined;

    expect(`${messageOf(error)} ${messageOf(cause)}`).toContain(
      'simulated failure'
    );
    expect(server.statements[1]).toMatch(
      /^\s*(?:BEGIN|START\s+TRANSACTION)\b[^;]*\bREAD\s+ONLY\b/i
    );
    expect(server.statements.at(-1)).toMatch(/^\s*ROLLBACK\b/i);
  });
});
