import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  MigrationBuilderActions,
  MigrationMap,
  MigrationSource,
  RunnerOption,
} from '../src';
import * as dbModule from '../src/db';
import type { DBConnection } from '../src/db';
import * as migrationModule from '../src/migration';
import * as loaderModule from '../src/migrationLoader';
import type { RunnerOptionConfig } from '../src/runner';
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
    };
    const options: RunnerOption = { ...baseOptions, migrations };
    const directoryOptions: RunnerOptionConfig = {
      migrationsTable: 'pgmigrations',
      direction: 'up',
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
    // @ts-expect-error Migration entries cannot be filesystem paths.
    acceptOptions({ ...baseOptions, migrations: { '001_path': './file.js' } });
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
    [
      { migrations: {}, useGlob: false },
      'useGlob and ignorePattern require a dir source',
    ],
    [
      { migrations: {}, ignorePattern: 'ignored' },
      'useGlob and ignorePattern require a dir source',
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
    Object.setPrototypeOf({ '001_init': {} }, null),
    // The map is not awaited, so `then` remains a valid migration identifier.
    // oxlint-disable-next-line unicorn/no-thenable
    { then: () => ({ up: () => {} }) },
  ])(
    'accepts ordinary and null-prototype maps, including a then identifier: %o',
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
      migrationLoaderStrategies: [{ extensions: ['.js'], loader: 'sql' }],
      tsconfigPaths: '/missing/tsconfig.json',
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
