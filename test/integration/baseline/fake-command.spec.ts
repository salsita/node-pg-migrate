import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseline } from '../../../src';
import {
  createDatabase,
  databaseUrl,
  INTEGRATION_TIMEOUT,
  loadSql,
  PG_VERSIONS,
  setupPostgresDatabase,
} from '../utils';
import { recordingLogger, workDir } from './helpers';

// The `--fake` command a TypeScript/JavaScript baseline prints (and writes in
// its header) must carry the table and schema options too, not only `-m`, so
// copying it records the baseline where later `up` runs look for it.

describe.each(PG_VERSIONS)(
  'the --fake command of a --format ts baseline (PG %s)',
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

    it('carries -t and --migrations-schema when they differ from the defaults', async () => {
      const database = 'ts_fake_command';
      await createDatabase(container, database);
      await loadSql(
        container,
        database,
        'CREATE TABLE public.widgets (id integer PRIMARY KEY, name text NOT NULL);'
      );
      const dir = join(await workDir(), 'migrations');

      const result = await baseline({
        databaseUrl: databaseUrl(container, database),
        format: 'ts',
        migrationsTable: 'custom_migrations',
        migrationsSchema: 'audit',
        dir,
        logger: recordingLogger(),
      });

      expect(result.fakeCommand).toContain('-t custom_migrations');
      expect(result.fakeCommand).toContain('--migrations-schema audit');

      const migration = await readFile(result.path, 'utf8');
      expect(migration).toContain('-t custom_migrations');
      expect(migration).toContain('--migrations-schema audit');
    });
  }
);
