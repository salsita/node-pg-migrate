import { readdirSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { getMigrationFilePaths } from '../src/migration';
import type { MigrationBuilder } from '../src/migrationBuilder';
import type {
  MigrationLoader,
  MigrationLoaderConfig,
  MigrationUnit,
} from '../src/migrationLoader';
import { loadMigrationUnits } from '../src/migrationLoader';

const sqlExtensions = [
  ['sql', 'sql'],
  ['SQL', 'SQL'],
  ['SqL', 'sQl'],
  ['sql', 'SQL'],
];

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
  it.each(sqlExtensions)(
    'keeps legacy SQL behavior for .up.%s / .down.%s by default',
    async (upExtension, downExtension) => {
      await withTempDir(async (dir) => {
        const upPath = await writeMigrationFile(
          dir,
          `001_create_users.up.${upExtension}`,
          '-- up migration\nCREATE TABLE users(id serial primary key);\n'
        );
        const downPath = await writeMigrationFile(
          dir,
          `001_create_users.down.${downExtension}`,
          '-- down migration\nDROP TABLE users;\n'
        );

        const units = await loadMigrationUnits({}, [upPath, downPath]);

        expect(units).toHaveLength(2);
        expect(units.map((u) => u.id)).toEqual([downPath, upPath].toSorted());
        expect(units.every((u) => u.filePaths.length === 1)).toBe(true);
      });
    }
  );

  it.each(sqlExtensions)(
    'groups .up.%s / .down.%s with their own SQL actions',
    async (upExtension, downExtension) => {
      await withTempDir(async (dir) => {
        const upSql = 'CREATE TABLE users(id serial primary key);\n';
        const downSql = 'DROP TABLE users;\n';
        const upPath = await writeMigrationFile(
          dir,
          `001_Create_Users.up.${upExtension}`,
          upSql
        );
        const downPath = await writeMigrationFile(
          dir,
          `001_Create_Users.down.${downExtension}`,
          downSql
        );

        const config: MigrationLoaderConfig = {
          migrationLoaderStrategies: [{ extensions: ['.sql'], loader: 'sql' }],
        };

        const units = await loadMigrationUnits(config, [downPath, upPath]);

        expect(units).toHaveLength(1);
        expect(units[0].id).toBe(join(dir, '001_Create_Users.sql'));
        expect(units[0].filePaths).toEqual([upPath, downPath]);
        expect(units[0].actions.up).toBeTypeOf('function');
        expect(units[0].actions.down).toBeTypeOf('function');

        const sql = vi.fn();
        const pgm = { sql } as unknown as MigrationBuilder;
        const { up, down } = units[0].actions;
        if (up) {
          await up(pgm);
        }
        expect(sql).toHaveBeenCalledExactlyOnceWith(upSql);
        sql.mockClear();
        if (down) {
          await down(pgm);
        }
        expect(sql).toHaveBeenCalledExactlyOnceWith(downSql);
      });
    }
  );

  it.each(['sql', 'SQL', 'SqL'])(
    'rejects .down.%s without a matching up file',
    async (extension) => {
      await withTempDir(async (dir) => {
        const downPath = await writeMigrationFile(
          dir,
          `001_create_users.down.${extension}`,
          'DROP TABLE users;\n'
        );

        const config: MigrationLoaderConfig = {
          migrationLoaderStrategies: [{ extensions: ['.sql'], loader: 'sql' }],
        };

        await expect(loadMigrationUnits(config, [downPath])).rejects.toThrow(
          'Found .down.sql without matching .up.sql for 001_create_users'
        );
      });
    }
  );

  it.each(['up', 'down', 'single'])(
    'rejects duplicate %s files with different extension case before reading them',
    async (direction) => {
      const suffix = direction === 'single' ? '' : `.${direction}`;
      const paths = [
        join('migrations', `001_init${suffix}.sql`),
        join('migrations', `001_init${suffix}.SQL`),
      ];

      await expect(
        loadMigrationUnits(
          {
            migrationLoaderStrategies: [
              { extensions: ['.sql'], loader: 'sql' },
            ],
          },
          paths
        )
      ).rejects.toThrow(`Duplicate ${suffix}.sql for 001_init`);
    }
  );

  it.each(sqlExtensions)(
    'rejects single .%s mixed with split .%s files',
    async (singleExtension, splitExtension) => {
      const paths = [
        join('migrations', `001_init.${singleExtension}`),
        join('migrations', `001_init.up.${splitExtension}`),
        join('migrations', `001_init.down.${splitExtension}`),
      ];

      await expect(
        loadMigrationUnits(
          {
            migrationLoaderStrategies: [
              { extensions: ['.sql'], loader: 'sql' },
            ],
          },
          paths
        )
      ).rejects.toThrow(
        'Conflicting SQL migration files for 001_init: cannot mix .sql with .up/.down'
      );
    }
  );

  describe.each(['sql', 'SQL', 'SqL'])('SQL extension .%s', (extension) => {
    it.each(['UP', 'Up', 'uP', 'DOWN', 'Down', 'dOwN'])(
      'rejects direction token .%s before reading files',
      async (direction) => {
        const fileName = `001_Init.${direction}.${extension}`;

        await expect(
          loadMigrationUnits(
            {
              migrationLoaderStrategies: [
                { extensions: ['.sql'], loader: 'sql' },
              ],
            },
            [join('migrations', fileName)]
          )
        ).rejects.toThrow(`Direction token must be lowercase: ${fileName}`);
      }
    );
  });

  it.each(['default', 'legacySql'] as const)(
    'keeps uppercase direction tokens unchanged with the %s SQL loader',
    async (loader) => {
      await withTempDir(async (dir) => {
        const paths = [
          await writeMigrationFile(dir, '001_Init.UP.SQL', 'SELECT 1;'),
          await writeMigrationFile(dir, '001_Init.DOWN.SqL', 'SELECT 2;'),
        ];
        const config: MigrationLoaderConfig =
          loader === 'default'
            ? {}
            : {
                migrationLoaderStrategies: [{ extensions: ['.sql'], loader }],
              };

        const units = await loadMigrationUnits(config, paths);
        expect(units.map(({ id }) => id)).toEqual(paths.toSorted());
        expect(units.map(({ filePaths }) => filePaths)).toEqual(
          paths.toSorted().map((path) => [path])
        );
      });
    }
  );

  it.each([
    '001_Init.SQL',
    '001_Init.SqL',
    '001_UP_Init.SQL',
    '001_Init.DOWN.backup.SqL',
  ])('preserves the standalone path for %s', async (fileName) => {
    await withTempDir(async (dir) => {
      const path = await writeMigrationFile(dir, fileName, 'SELECT 1;');
      const units = await loadMigrationUnits(
        {
          migrationLoaderStrategies: [{ extensions: ['.sql'], loader: 'sql' }],
        },
        [path]
      );

      expect(units).toHaveLength(1);
      expect(units[0].id).toBe(path);
      expect(units[0].filePaths).toEqual([path]);
      expect(units[0].actions.down).toBe(false);
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

    const makeLoader = (ext: string) => (bucketFilePaths: string[]) => {
      calls.push({ ext, filePaths: [...bucketFilePaths] });

      return Promise.resolve(
        bucketFilePaths.map((filePath) => ({
          id: filePath,
          filePaths: [filePath],
          actions: { up: () => {}, down: () => {}, shorthands: {} },
        }))
      );
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

      expect(filePaths.map((p) => basename(p))).toEqual([
        '2_foo.js',
        '10_bar.js',
      ]);
      expect(filePaths).toEqual([path2, path10]);

      const customLoader: MigrationLoader = (bucketFilePaths) =>
        Promise.resolve(
          bucketFilePaths.map((filePath) => ({
            id: filePath,
            filePaths: [filePath],
            actions: { up: () => {}, down: () => {}, shorthands: {} },
          }))
        );

      const config: MigrationLoaderConfig = {
        migrationLoaderStrategies: [
          { extensions: ['.js'], loader: customLoader },
        ],
      };

      const units = await loadMigrationUnits(config, filePaths);

      expect(units.map((u) => basename(u.filePaths[0]))).toEqual([
        '2_foo.js',
        '10_bar.js',
      ]);
    });
  });

  it.each(['sql', 'SQL', 'SqL'])(
    'loads .up.%s alone with a normalized ID and undefined down action',
    async (extension) => {
      await withTempDir(async (dir) => {
        const upPath = await writeMigrationFile(
          dir,
          `001_create_users.up.${extension}`,
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
    }
  );

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
