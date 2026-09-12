import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseline, BaselineError } from '../../../src';
import { messageOf } from '../../baseline/helpers';
import {
  createDatabase,
  databaseUrl,
  INTEGRATION_TIMEOUT,
  loadSql,
  PG_VERSIONS,
  setupPostgresDatabase,
} from '../utils';
import {
  listFiles,
  pgDumpShimForTest,
  recordingLogger,
  rejectionOf,
  workDir,
} from './helpers';

// Names of --include-schema are matched exactly. A name that matches no
// schema of the database (a typo, or `Audit` for `audit`) must not silently
// leave that schema out of the baseline: baseline refuses and names it.

/**
 * Include names where `app` exists, `Audit` only differs from the existing
 * `audit` in case, and `nosuch` does not exist at all.
 */
const WITH_UNKNOWN = ['app', 'Audit', 'nosuch'];

/**
 * Creates a database with the schemas `app` and `audit`, a table in each.
 *
 * @param container The PostgreSQL container.
 * @param database The name of the database.
 */
async function withAppAndAuditSchemas(
  container: StartedPostgreSqlContainer,
  database: string
): Promise<void> {
  await createDatabase(container, database);
  await loadSql(
    container,
    database,
    [
      'CREATE SCHEMA app;',
      'CREATE TABLE app.orders (id integer PRIMARY KEY);',
      'CREATE SCHEMA audit;',
      'CREATE TABLE audit.entries (id integer PRIMARY KEY);',
    ].join('\n')
  );
}

/**
 * Checks that a baseline was refused because of the unknown names of
 * {@link WITH_UNKNOWN}, and that it wrote nothing.
 *
 * @param error What `baseline()` rejected with.
 * @param dir The migrations directory.
 */
async function expectUnknownSchemasRefused(
  error: unknown,
  dir: string
): Promise<void> {
  expect(error).toBeInstanceOf(BaselineError);
  expect(error).toMatchObject({ code: 'INVALID_OPTIONS' });
  const message = messageOf(error);
  // Every unknown name is named, not only the first.
  expect(message).toContain('Audit');
  expect(message).toContain('nosuch');
  expect(await listFiles(dir)).toEqual([]);
}

describe.each(PG_VERSIONS)(
  'baseline --include-schema names that do not exist (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (postgresVersion) => {
    let container: StartedPostgreSqlContainer;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${postgresVersion}-alpine`
      );
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      await container?.stop();
    });

    it('refuses unknown include schemas with --format sql (pg_dump path)', async () => {
      const database = 'include_sql';
      await withAppAndAuditSchemas(container, database);
      const pgDump = await pgDumpShimForTest(container);
      const dir = join(await workDir(), 'migrations');

      const error = await rejectionOf(
        baseline({
          databaseUrl: databaseUrl(container, database),
          pgDump,
          includeSchemas: WITH_UNKNOWN,
          dir,
          logger: recordingLogger(),
        })
      );

      await expectUnknownSchemasRefused(error, dir);
    });

    it('refuses unknown include schemas with --format ts (catalog path)', async () => {
      const database = 'include_ts';
      await withAppAndAuditSchemas(container, database);
      const dir = join(await workDir(), 'migrations');

      const error = await rejectionOf(
        baseline({
          databaseUrl: databaseUrl(container, database),
          format: 'ts',
          includeSchemas: WITH_UNKNOWN,
          dir,
          logger: recordingLogger(),
        })
      );

      await expectUnknownSchemasRefused(error, dir);
    });

    it('accepts include schemas that all exist, with either format', async () => {
      const database = 'include_known';
      await withAppAndAuditSchemas(container, database);
      const url = databaseUrl(container, database);
      const pgDump = await pgDumpShimForTest(container);

      const sql = await baseline({
        databaseUrl: url,
        pgDump,
        includeSchemas: ['app', 'audit'],
        dir: join(await workDir(), 'migrations'),
        logger: recordingLogger(),
      });
      const ts = await baseline({
        databaseUrl: url,
        format: 'ts',
        includeSchemas: ['app', 'audit'],
        dir: join(await workDir(), 'migrations'),
        logger: recordingLogger(),
      });

      for (const { path } of [sql, ts]) {
        const content = await readFile(path, 'utf8');
        expect(content).toContain('orders');
        expect(content).toContain('entries');
      }
    });
  }
);
