import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Migration, RunnerOption } from '../../src';
import type { DBConnection } from '../../src/db';
import { loadMigrations } from '../../src/runner';
import { jiti } from '../../src/utils/jiti';

describe('loadMigrations', () => {
  it('should load migration files using jiti', async () => {
    const migrationsDir = resolve(import.meta.dirname, 'migrations');
    const migrationFiles = readdirSync(migrationsDir).map((f) =>
      join(migrationsDir, f)
    );

    const importSpy = vi.spyOn(jiti, 'import').mockResolvedValue({
      up: () => {},
      down: () => {},
      shorthands: {},
    });

    const db: DBConnection = {} as never;
    const options: RunnerOption = {
      dir: resolve(import.meta.dirname, 'migrations'),
      ignorePattern: undefined,
      useGlob: false,
      migrationsTable: 'migrations',
      direction: 'up',
      databaseUrl: 'postgres://user:pass@localhost/db',
    };
    const logger = console;

    const migrations: Migration[] = await loadMigrations(db, options, logger);

    for (const file of migrationFiles) {
      expect(importSpy).toHaveBeenCalledWith(file);
    }

    expect(migrations).toHaveLength(migrationFiles.length);
    for (const migration of migrations) {
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
      expect(typeof migration.typeShorthands).toBe('object');
    }

    importSpy.mockRestore();
  });
});
