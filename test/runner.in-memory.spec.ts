import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  MigrationBuilder,
  MigrationBuilderActions,
  MigrationMap,
  MigrationModule,
  MigrationSource,
  RunnerOption,
  RunnerOptionDirectory,
} from '../src';
import * as dbModule from '../src/db';
import type { DBConnection } from '../src/db';
import * as migrationModule from '../src/migration';
import * as loaderModule from '../src/migrationLoader';
import { loadMigrations, runner } from '../src/runner';

const baseOptions = {
  databaseUrl: 'postgres://user:password@localhost/database',
  migrationsTable: 'pgmigrations',
  direction: 'up' as const,
};

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('in-memory migration options', () => {
  it('accepts direct actions, sync and async factories through the public types', () => {
    const actions: MigrationBuilderActions = { up: () => {}, down: false };
    const source: MigrationSource = () => actions;
    const migrations: MigrationMap = {
      '001_direct': actions,
      '002_sync': source,
      '003_async': () => Promise.resolve(actions),
      '004_default': { default: actions },
      '005_default_factory': () => Promise.resolve({ default: actions }),
    };
    const options: RunnerOption = { ...baseOptions, migrations };
    const directoryOptions: RunnerOptionDirectory = {
      ...baseOptions,
      dir: 'migrations',
    };
    const directoryRunner: RunnerOption = {
      ...directoryOptions,
      databaseUrl: baseOptions.databaseUrl,
    };
    const acceptOptions = (value: RunnerOption) => value;

    expect(acceptOptions(options).migrations).toBe(migrations);
    expect(acceptOptions(directoryRunner).dir).toBe('migrations');

    // @ts-expect-error A runner needs a migration source.
    acceptOptions(baseOptions);
    // @ts-expect-error The migration sources are mutually exclusive.
    acceptOptions({ ...baseOptions, dir: 'migrations', migrations });
    // @ts-expect-error Glob discovery requires directory migrations.
    acceptOptions({ ...baseOptions, migrations, useGlob: true });
    // @ts-expect-error Ignore patterns require directory migrations.
    acceptOptions({ ...baseOptions, migrations, ignorePattern: 'ignored' });
    // @ts-expect-error Filesystem loading strategies require directory migrations.
    acceptOptions({
      ...baseOptions,
      migrations,
      migrationLoaderStrategies: [],
    });
    // @ts-expect-error Tsconfig resolution requires directory migrations, even when disabled.
    acceptOptions({ ...baseOptions, migrations, tsconfigPaths: false });
    // @ts-expect-error Migration entries cannot be filesystem paths.
    acceptOptions({ ...baseOptions, migrations: { '001_path': './file.js' } });
  });

  it('supports directory wrappers using the public source variant', () => {
    function defaults(
      options: Partial<RunnerOptionDirectory> = {}
    ): RunnerOption {
      return { ...baseOptions, dir: 'migrations', ...options };
    }

    type Options = { databaseUrl: string };
    const opts: Omit<RunnerOptionDirectory, 'direction'> & Options = {
      migrationsTable: 'pgmigrations',
      dir: 'migrations',
      databaseUrl: baseOptions.databaseUrl,
    };
    const options: RunnerOption = { ...opts, direction: 'up' };

    expect(defaults({ tsconfigPaths: false }).dir).toBe('migrations');
    expect(options.dir).toBe('migrations');
  });

  it.each([
    [{}, 'You must provide exactly one of dir or migrations'],
    [
      { dir: 'migrations', migrations: {} },
      'You must provide exactly one of dir or migrations',
    ],
    [
      { migrations: null },
      'migrations must be an object mapping names to actions or factories',
    ],
    [
      { migrations: [] },
      'migrations must be an object mapping names to actions or factories',
    ],
    [
      { migrations: 'migrations' },
      'migrations must be an object mapping names to actions or factories',
    ],
    [
      { migrations: Promise.resolve({ '001_init': {} }) },
      'migrations must be an object mapping names to actions or factories',
    ],
    [
      { migrations: new Map([['001_init', {}]]) },
      'migrations must be an object mapping names to actions or factories',
    ],
    [
      { migrations: new Date(0) },
      'migrations must be an object mapping names to actions or factories',
    ],
    [
      { migrations: new Set(['001_init']) },
      'migrations must be an object mapping names to actions or factories',
    ],
    [{ migrations: {}, useGlob: false }, 'useGlob requires a dir source'],
    [
      { migrations: {}, ignorePattern: 'ignored' },
      'ignorePattern requires a dir source',
    ],
    [
      { migrations: {}, migrationLoaderStrategies: [] },
      'migrationLoaderStrategies requires a dir source',
    ],
    [
      { migrations: {}, tsconfigPaths: false },
      'tsconfigPaths requires a dir source',
    ],
    [
      { migrations: { '': {} } },
      'Migration identifiers must have a non-empty name',
    ],
    [
      { migrations: { '001_path': './file.js' } },
      'Migration 001_path must contain actions or a factory',
    ],
    [
      { migrations: { '001_invalid': { up: true } } },
      'Migration 001_invalid must contain actions or a factory',
    ],
    [
      { migrations: { '001_promise': Promise.resolve({}) } },
      'Migration 001_promise must contain actions or a factory',
    ],
    [
      { migrations: { '001_typo': { upp: () => {} } } },
      'Migration 001_typo must contain actions or a factory',
    ],
    [
      { migrations: { '001_empty': {} } },
      'Migration 001_empty must contain actions or a factory',
    ],
    [
      { migrations: { '001_default': { default: { upp: () => {} } } } },
      'Migration 001_default must contain actions or a factory',
    ],
    [
      {
        migrations: {
          '001_named': { up: 'invalid', default: { up: () => {} } },
        },
      },
      'Migration 001_named must contain actions or a factory',
    ],
    [
      { migrations: { '001_undefined': { up: undefined } } },
      'Migration 001_undefined must contain actions or a factory',
    ],
    [
      { migrations: { '001_shorthands': { shorthands: [] } } },
      'Migration 001_shorthands must contain actions or a factory',
    ],
    [
      { migrations: { '20269999000000000_invalid.js': { up: () => {} } } },
      'Migration 20269999000000000_invalid.js must have a valid numeric prefix',
    ],
    [
      { migrations: { init: { up: () => {} } } },
      'Cannot determine numeric prefix for "init"',
    ],
    [
      // Deliberately malformed JavaScript input; it must be rejected before connecting.
      // oxlint-disable-next-line unicorn/no-thenable
      { migrations: { then: () => ({ up: () => {} }) } },
      'Cannot determine numeric prefix for "then"',
    ],
  ])(
    'rejects invalid sources before constructing the DB: %o',
    async (source, message) => {
      const query = vi.fn();
      const createDb = vi.spyOn(dbModule, 'db').mockImplementation(() => {
        throw new Error('DB must not be constructed');
      });

      await expect(
        runner({
          ...baseOptions,
          dbClient: { query } as never,
          ...source,
        } as RunnerOption)
      ).rejects.toThrow(message);

      expect(createDb).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
    }
  );

  it.each([
    {},
    Object.setPrototypeOf({ '001_init': { up: () => {} } }, null),
    { '001_shorthands.js': { shorthands: { title: 'text' } } },
  ])(
    'accepts empty maps, null-prototype maps and shorthands-only modules: %o',
    async (migrations: MigrationMap) => {
      const createDb = vi.spyOn(dbModule, 'db').mockImplementation(() => {
        throw new Error('source validation passed');
      });

      await expect(runner({ ...baseOptions, migrations })).rejects.toThrow(
        'source validation passed'
      );
      expect(createDb).toHaveBeenCalledOnce();
    }
  );

  it.each([
    { '001_init.js': {}, '001_init.ts': {} },
    { 'first/001_init.js': {}, 'second/001_init.js': {} },
  ])(
    'rejects duplicate history names before invoking factories or constructing the DB',
    async (entries) => {
      const factory = vi.fn(() => ({}));
      const createDb = vi.spyOn(dbModule, 'db');
      const migrations = Object.fromEntries(
        Object.keys(entries).map((id) => [id, factory])
      );

      await expect(runner({ ...baseOptions, migrations })).rejects.toThrow(
        'Duplicate migration name: 001_init'
      );
      expect(factory).not.toHaveBeenCalled();
      expect(createDb).not.toHaveBeenCalled();
    }
  );
});

describe('in-memory migration loading', () => {
  it('sorts identifiers before loading factories sequentially and accumulating shorthands', async () => {
    const events: string[] = [];
    const actions: MigrationBuilderActions = { up: () => {} };
    const options: RunnerOption = {
      ...baseOptions,
      migrations: {
        'bundled/001_item10.js': () => {
          events.push('10');
          return actions;
        },
        'bundled/002_next.js': () => {
          events.push('next');
          return { shorthands: { title: 'text' } };
        },
        'bundled/001_item2.js': async () => {
          events.push('2:start');
          await Promise.resolve();
          events.push('2:end');
          return { ...actions, shorthands: { title: 'varchar(20)' } };
        },
      },
    };
    const paths = vi.spyOn(migrationModule, 'getMigrationFilePaths');
    const fileLoader = vi.spyOn(loaderModule, 'loadMigrationUnits');

    const migrations = await loadMigrations(
      {} as DBConnection,
      options,
      logger
    );

    expect(events).toEqual(['2:start', '2:end', '10', 'next']);
    expect(migrations.map(({ name }) => name)).toEqual([
      '001_item2',
      '001_item10',
      '002_next',
    ]);
    expect(migrations.map(({ path }) => path)).toEqual([
      'bundled/001_item2.js',
      'bundled/001_item10.js',
      'bundled/002_next.js',
    ]);
    expect(migrations.map(({ typeShorthands }) => typeShorthands)).toEqual([
      { title: 'varchar(20)' },
      { title: 'varchar(20)' },
      { title: 'text' },
    ]);
    expect(paths).not.toHaveBeenCalled();
    expect(fileLoader).not.toHaveBeenCalled();
  });

  it('accepts an empty map without scanning the filesystem', async () => {
    const paths = vi.spyOn(migrationModule, 'getMigrationFilePaths');

    await expect(
      loadMigrations(
        {} as DBConnection,
        { ...baseOptions, migrations: {} },
        logger
      )
    ).resolves.toEqual([]);
    expect(paths).not.toHaveBeenCalled();
  });

  it.each(['direct', 'factory'])(
    'normalizes a %s default-only namespace before creating migrations',
    async (source) => {
      const up = vi.fn(() => {});
      const actions: MigrationBuilderActions = { up, down: false };
      const namespace: MigrationModule = { default: actions };
      const migrations = await loadMigrations(
        {} as DBConnection,
        {
          ...baseOptions,
          migrations: {
            '001_default.mjs':
              source === 'direct'
                ? namespace
                : () => Promise.resolve(namespace),
          },
        },
        logger
      );

      await migrations[0]._getAction('up')({} as MigrationBuilder);
      expect(up).toHaveBeenCalledOnce();
      expect(migrations[0]?.down).toBe(false);
    }
  );

  it('preserves named exports over default actions and shorthands', async () => {
    const up = () => {};
    const down = vi.fn(() => {});
    const migrations = await loadMigrations(
      {} as DBConnection,
      {
        ...baseOptions,
        migrations: {
          '001_mixed': {
            up,
            shorthands: { title: 'text' },
            default: { up: () => {}, down, shorthands: { title: 'integer' } },
          },
        },
      },
      logger
    );

    expect(migrations[0]?.up).toBe(up);
    await migrations[0]._getAction('down')({} as MigrationBuilder);
    expect(down).toHaveBeenCalledOnce();
    expect(migrations[0]?.typeShorthands).toEqual({ title: 'text' });
  });

  it.each(['direct', 'factory'])(
    'preserves the default object as this for %s namespace methods',
    async (source) => {
      const contexts: unknown[] = [];
      const actions: MigrationBuilderActions = {
        up() {
          contexts.push(this);
        },
        down() {
          contexts.push(this);
        },
      };
      const namespace: MigrationModule = { default: actions };
      const migrations = await loadMigrations(
        {} as DBConnection,
        {
          ...baseOptions,
          migrations: {
            '001_methods':
              source === 'direct'
                ? namespace
                : () => Promise.resolve(namespace),
          },
        },
        logger
      );
      const pgm = {} as MigrationBuilder;

      await migrations[0]._getAction('up')(pgm);
      await migrations[0]._getAction('down')(pgm);
      expect(contexts).toEqual([actions, actions]);
    }
  );

  it.each([
    {
      description: 'throwing',
      factory: () => {
        throw new Error('load failed');
      },
      message: 'load failed',
    },
    {
      description: 'rejecting',
      factory: () => Promise.reject(new Error('load failed')),
      message: 'load failed',
    },
    {
      description: 'non-Error rejection',
      // Exercise the error boundary for factories supplied by JavaScript callers.
      // oxlint-disable-next-line eslint/prefer-promise-reject-errors, typescript/prefer-promise-reject-errors
      factory: () => Promise.reject('load failed'),
      message: 'Unknown error',
    },
    {
      description: 'invalid result',
      factory: () => './migration.js',
      message: 'Migration factory 001_init must return migration actions',
    },
    {
      description: 'null result',
      factory: () => null,
      message: 'Migration factory 001_init must return migration actions',
    },
    {
      description: 'misspelled action',
      factory: () => ({ upp: () => {} }),
      message: 'Migration factory 001_init must return migration actions',
    },
    {
      description: 'invalid default action',
      factory: () => ({ default: { upp: () => {} } }),
      message: 'Migration factory 001_init must return migration actions',
    },
  ])(
    'reports a $description factory failure without invoking later factories',
    async ({ factory, message }) => {
      const next = vi.fn(() => ({}));
      const options = {
        ...baseOptions,
        migrations: { '002_next': next, '001_init': factory },
      } as RunnerOption;

      await expect(
        loadMigrations({} as DBConnection, options, logger)
      ).rejects.toThrow(`Error loading migrations: ${message}`);
      expect(next).not.toHaveBeenCalled();
    }
  );
});
