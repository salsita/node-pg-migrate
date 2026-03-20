import { readdirSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getMigrationFilePaths } from '../src/migration';
import type {
  MigrationLoader,
  MigrationLoaderConfig,
  MigrationUnit,
} from '../src/migrationLoader';
import { loadMigrationUnits } from '../src/migrationLoader';

async function withTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'npm-migration-loader-test-'));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function writeMigrationFile(
  dir: string,
  fileName: string,
  content: string
): Promise<string> {
  const path = join(dir, fileName);
  await writeFile(path, content, 'utf8');
  return path;
}

describe('loadMigrationUnits', () => {
  it('keeps legacy SQL behavior by default (.up/.down are separate migrations)', async () => {
    await withTempDir(async (dir) => {
      const upPath = await writeMigrationFile(
        dir,
        '001_create_users.up.sql',
        '-- up migration\nCREATE TABLE users(id serial primary key);\n'
      );
      const downPath = await writeMigrationFile(
        dir,
        '001_create_users.down.sql',
        '-- down migration\nDROP TABLE users;\n'
      );

      const units = await loadMigrationUnits({}, [upPath, downPath]);

      expect(units).toHaveLength(2);
      expect(units.map((u) => u.id)).toEqual([downPath, upPath].toSorted());
      expect(units.every((u) => u.filePaths.length === 1)).toBe(true);
    });
  });

  it('groups .up/.down SQL files when the new sql loader is configured', async () => {
    await withTempDir(async (dir) => {
      const upPath = await writeMigrationFile(
        dir,
        '001_create_users.up.sql',
        'CREATE TABLE users(id serial primary key);\n'
      );
      const downPath = await writeMigrationFile(
        dir,
        '001_create_users.down.sql',
        'DROP TABLE users;\n'
      );

      const config: MigrationLoaderConfig = {
        migrationLoaderStrategies: [{ extensions: ['.sql'], loader: 'sql' }],
      };

      const units = await loadMigrationUnits(config, [upPath, downPath]);

      expect(units).toHaveLength(1);
      expect(units[0].id).toBe(join(dir, '001_create_users.sql'));
      expect(units[0].filePaths).toEqual([upPath, downPath]);
      expect(units[0].actions.up).toBeTypeOf('function');
      expect(units[0].actions.down).toBeTypeOf('function');
    });
  });

  it('throws when sql loader sees .down.sql without matching .up.sql', async () => {
    await withTempDir(async (dir) => {
      const downPath = await writeMigrationFile(
        dir,
        '001_create_users.down.sql',
        'DROP TABLE users;\n'
      );

      const config: MigrationLoaderConfig = {
        migrationLoaderStrategies: [{ extensions: ['.sql'], loader: 'sql' }],
      };

      await expect(loadMigrationUnits(config, [downPath])).rejects.toThrow(
        'Found .down.sql without matching .up.sql for 001_create_users'
      );
    });
  });

  it('uses custom loader only for matched extension buckets', async () => {
    await withTempDir(async (dir) => {
      const jsPath = await writeMigrationFile(
        dir,
        '001_script.js',
        'export const shorthands = {};\nexport const up = () => {};\nexport const down = () => {};\n'
      );
      const mjsPath = await writeMigrationFile(
        dir,
        '002_script.mjs',
        'export const shorthands = {};\nexport const up = () => {};\nexport const down = () => {};\n'
      );

      const customId = '000_custom-js-id';
      const customUnits: MigrationUnit[] = [
        {
          id: customId,
          filePaths: [jsPath],
          actions: {
            up: () => {},
            down: () => {},
            shorthands: {},
          },
        },
      ];

      const customLoader: MigrationLoader = () => Promise.resolve(customUnits);

      const config: MigrationLoaderConfig = {
        migrationLoaderStrategies: [
          { extensions: ['.js'], loader: customLoader },
        ],
      };

      const units = await loadMigrationUnits(config, [jsPath, mjsPath]);
      const ids = units.map((u) => u.id);

      expect(ids).toContain(customId);
      expect(ids).toContain(mjsPath);
      expect(units).toHaveLength(2);
    });
  });

  it('preserves input ordering within each extension bucket', async () => {
    const calls: Array<{ ext: string; filePaths: string[] }> = [];

    const makeLoader =
      (ext: string) =>
      async (bucketFilePaths: string[]) => {
        calls.push({ ext, filePaths: [...bucketFilePaths] });

        return bucketFilePaths.map((filePath) => ({
          id: filePath,
          filePaths: [filePath],
          actions: { up: () => {}, down: () => {}, shorthands: {} },
        }));
      };

    const config: MigrationLoaderConfig = {
      migrationLoaderStrategies: [
        { extensions: ['.sql'], loader: makeLoader('.sql') },
        { extensions: ['.js'], loader: makeLoader('.js') },
      ],
    };

    // `.sql` appears first, so the `.sql` bucket must be processed first.
    // Within each bucket, the order must match the input array order.
    const filePaths = [
      join(process.cwd(), '010_one.sql'),
      join(process.cwd(), '002_b.js'),
      join(process.cwd(), '001_a.js'),
      join(process.cwd(), '011_two.sql'),
    ];

    await loadMigrationUnits(config, filePaths);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({
      ext: '.sql',
      filePaths: [filePaths[0], filePaths[3]],
    });
    expect(calls[1]).toEqual({
      ext: '.js',
      filePaths: [filePaths[1], filePaths[2]],
    });
  });

  it('orders 2_foo.js before 10_bar.js consistently between getMigrationFilePaths and loadMigrationUnits', async () => {
    await withTempDir(async (dir) => {
      const path2 = await writeMigrationFile(
        dir,
        '2_foo.js',
        'export const shorthands = {};\nexport const up = () => {};\nexport const down = () => {};\n'
      );
      const path10 = await writeMigrationFile(
        dir,
        '10_bar.js',
        'export const shorthands = {};\nexport const up = () => {};\nexport const down = () => {};\n'
      );

      const filePaths = await getMigrationFilePaths(dir, {});

      expect(filePaths.map((p) => basename(p))).toEqual(['2_foo.js', '10_bar.js']);
      expect(filePaths).toEqual([path2, path10]);

      const customLoader: MigrationLoader = async (bucketFilePaths) =>
        bucketFilePaths.map((filePath) => ({
          id: filePath,
          filePaths: [filePath],
          actions: { up: () => {}, down: () => {}, shorthands: {} },
        }));

      const config: MigrationLoaderConfig = {
        migrationLoaderStrategies: [{ extensions: ['.js'], loader: customLoader }],
      };

      const units = await loadMigrationUnits(config, filePaths);

      expect(units.map((u) => basename(u.filePaths[0]))).toEqual([
        '2_foo.js',
        '10_bar.js',
      ]);
    });
  });

  it('groups .up.sql-only (no .down.sql) into a single migration with undefined down action', async () => {
    await withTempDir(async (dir) => {
      const upPath = await writeMigrationFile(
        dir,
        '001_create_users.up.sql',
        'CREATE TABLE users(id serial primary key);\n'
      );

      const config: MigrationLoaderConfig = {
        migrationLoaderStrategies: [{ extensions: ['.sql'], loader: 'sql' }],
      };

      const units = await loadMigrationUnits(config, [upPath]);

      expect(units).toHaveLength(1);
      expect(units[0].id).toBe(join(dir, '001_create_users.sql'));
      expect(units[0].filePaths).toEqual([upPath]);
      expect(units[0].actions.up).toBeTypeOf('function');
      expect(units[0].actions.down).toBeUndefined();
    });
  });

  it('sorts cockroach files up to 062 in numeric order and keeps 062_view before 062_view_test', async () => {
    const customLoader: MigrationLoader = (filePaths) =>
      Promise.resolve(
        filePaths.map((filePath) => ({
          id: filePath,
          filePaths: [filePath],
          actions: {
            up: () => {},
            down: () => {},
            shorthands: {},
          },
        }))
      );

    const config: MigrationLoaderConfig = {
      migrationLoaderStrategies: [
        { extensions: ['.js'], loader: customLoader },
      ],
    };

    const cockroachDir = resolve(import.meta.dirname, 'cockroach');
    const filePaths = readdirSync(cockroachDir)
      .filter((fileName) => {
        const match = /^(\d+)_.*\.js$/.exec(fileName);
        if (!match) {
          return false;
        }

        const prefix = Number(match[1]);
        return prefix <= 62;
      })
      .toSorted()
      .map((fileName) => join(cockroachDir, fileName));

    const units = await loadMigrationUnits(config, filePaths);
    const sortedNames = units.map((unit) => basename(unit.filePaths[0]));
    const sortedPrefixes = sortedNames.map((fileName) =>
      Number((/^(\d+)_/.exec(fileName) ?? [])[1])
    );

    expect(sortedPrefixes).toEqual(sortedPrefixes.toSorted((a, b) => a - b));

    expect(sortedNames.indexOf('062_view.js')).toBeGreaterThanOrEqual(0);
    expect(sortedNames.indexOf('062_view_test.js')).toBeGreaterThanOrEqual(0);
    expect(sortedNames.indexOf('062_view.js')).toBeLessThan(
      sortedNames.indexOf('062_view_test.js')
    );

    // Regression check for the observed bug.
    expect(units.slice(-2).map((unit) => unit.filePaths[0])).toEqual([
      join(cockroachDir, '062_view.js'),
      join(cockroachDir, '062_view_test.js'),
    ]);
  });
});
