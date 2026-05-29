import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Migration, RunnerOption } from '../../src';
import type { DBConnection } from '../../src/db';
import { loadMigrations } from '../../src/runner';

describe('loadMigrations with tsconfigPaths', () => {
  const tsconfigPath = resolve(
    import.meta.dirname,
    'tsconfig-paths/tsconfig.json'
  );
  const db: DBConnection = {} as never;

  function createOptions(
    dir: string,
    tsconfigPaths: RunnerOption['tsconfigPaths']
  ): RunnerOption {
    return {
      dir,
      ignorePattern: undefined,
      useGlob: false,
      migrationsTable: 'migrations',
      direction: 'up',
      databaseUrl: 'postgres://user:pass@localhost/db',
      tsconfigPaths,
    };
  }

  it('should resolve tsconfig path aliases when given an explicit tsconfig path', async () => {
    const dir = resolve(import.meta.dirname, 'tsconfig-paths/migrations');

    const migrations: Migration[] = await loadMigrations(
      db,
      createOptions(dir, tsconfigPath),
      console
    );

    expect(migrations).toHaveLength(1);
    expect(migrations[0].up).toBeTypeOf('function');
    expect(migrations[0].down).toBeTypeOf('function');
  });

  it('should fail to resolve the alias when tsconfigPaths is disabled', async () => {
    // Uses a dedicated migration file: jiti caches transforms per file path, so
    // reusing the file from the test above would hit a cache entry that already
    // has the alias resolved and mask the disabled behaviour.
    const dir = resolve(
      import.meta.dirname,
      'tsconfig-paths/uncached-migrations'
    );

    await expect(
      loadMigrations(db, createOptions(dir, undefined), console)
    ).rejects.toThrow('Error loading migration files');
  });
});
