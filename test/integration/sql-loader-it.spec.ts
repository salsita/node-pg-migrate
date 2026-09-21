import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import type { RunnerOption } from '../../src';
import { runner } from '../../src';
import {
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

const migrationName = '1000000000000_Init';
const upSql = 'CREATE TABLE sql_loader.example (id integer);';
const downSql = 'DROP TABLE sql_loader.example;';

describe.each(PG_VERSIONS)(
  'grouped SQL extension case (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;
    let dir: string;
    let options: RunnerOption;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'sql_loader'
      );
      client = new pg.Client(container.getConnectionUri());
      await client.connect();
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      if (client) {
        await client.end();
      }
      if (container) {
        await container.stop();
      }
    });

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'pgm-SQL-loader-'));
      await client.query('CREATE SCHEMA sql_loader');
      options = {
        direction: 'up',
        databaseUrl: container.getConnectionUri(),
        dir,
        schema: 'sql_loader',
        migrationsSchema: 'sql_loader',
        migrationsTable: 'pgmigrations',
        migrationLoaderStrategies: [{ extensions: ['.sql'], loader: 'sql' }],
        log: () => {},
      };
    });

    afterEach(async () => {
      try {
        await client.query('DROP SCHEMA IF EXISTS sql_loader CASCADE');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    async function writePair(upExtension: string, downExtension: string) {
      await writeFile(join(dir, `${migrationName}.up.${upExtension}`), upSql);
      await writeFile(
        join(dir, `${migrationName}.down.${downExtension}`),
        downSql
      );
    }

    async function history() {
      return (
        await client.query(
          'SELECT id, name, run_on FROM sql_loader.pgmigrations ORDER BY id'
        )
      ).rows;
    }

    async function tableExists() {
      const result = await client.query<{ present: boolean }>(
        "SELECT to_regclass('sql_loader.example') IS NOT NULL AS present"
      );
      return result.rows[0].present;
    }

    it.each([
      ['sql', 'sql'],
      ['SQL', 'SQL'],
      ['SqL', 'sQl'],
      ['sql', 'SQL'],
    ])(
      'runs .up.%s / .down.%s as one migration',
      async (upExtension, downExtension) => {
        await writePair(upExtension, downExtension);

        const applied = await runner({ ...options, direction: 'up' });
        expect(applied.map(({ name, path }) => ({ name, path }))).toEqual([
          { name: migrationName, path: join(dir, `${migrationName}.sql`) },
        ]);
        expect(await tableExists()).toBe(true);
        const recorded = await history();
        expect(recorded).toEqual([
          {
            id: expect.any(Number),
            name: migrationName,
            run_on: expect.any(Date),
          },
        ]);

        expect(await runner({ ...options, direction: 'up' })).toEqual([]);
        expect(await history()).toEqual(recorded);
        expect(await tableExists()).toBe(true);

        const reverted = await runner({ ...options, direction: 'down' });
        expect(reverted.map(({ name }) => name)).toEqual([migrationName]);
        expect(await tableExists()).toBe(false);
        expect(await history()).toEqual([]);
      }
    );

    it.each([
      ['sql', 'SQL', 'SQL'],
      ['SQL', 'SqL', 'sql'],
      ['SqL', 'sql', 'sQl'],
    ])(
      'preserves history when a .%s file becomes .up.%s / .down.%s',
      async (singleExtension, upExtension, downExtension) => {
        const singlePath = join(dir, `${migrationName}.${singleExtension}`);
        await writeFile(
          singlePath,
          `-- Up Migration\n${upSql}\n-- Down Migration\n${downSql}\n`
        );
        await runner({ ...options, direction: 'up' });
        const recorded = await history();
        expect(recorded).toEqual([
          {
            id: expect.any(Number),
            name: migrationName,
            run_on: expect.any(Date),
          },
        ]);

        await rm(singlePath);
        await writePair(upExtension, downExtension);
        expect(await runner({ ...options, direction: 'up' })).toEqual([]);
        expect(await history()).toEqual(recorded);
        expect(await tableExists()).toBe(true);

        const reverted = await runner({ ...options, direction: 'down' });
        expect(reverted.map(({ name }) => name)).toEqual([migrationName]);
        expect(await tableExists()).toBe(false);
        expect(await history()).toEqual([]);
      }
    );

    it.each(['UP.SQL', 'Down.SqL', 'dOwN.sql'])(
      'rejects .%s before changing data or history',
      async (suffix) => {
        await writeFile(join(dir, `${migrationName}.sql`), upSql);
        await runner(options);
        await client.query('INSERT INTO sql_loader.example VALUES (1)');
        const recorded = await history();
        const fileName = `2000000000000_Invalid.${suffix}`;
        await writeFile(join(dir, fileName), downSql);

        await expect(runner(options)).rejects.toThrow(
          `Direction token must be lowercase: ${fileName}`
        );

        expect(await history()).toEqual(recorded);
        expect(
          (await client.query('SELECT id FROM sql_loader.example')).rows
        ).toEqual([{ id: 1 }]);
      }
    );

    it.each([false, true])(
      'preserves manually corrected history (paired: %s)',
      async (paired) => {
        await writeFile(
          join(dir, `${migrationName}.up.SQL`),
          'CREATE TABLE IF NOT EXISTS sql_loader.example (id integer);\n' +
            'INSERT INTO sql_loader.example VALUES (1);'
        );
        if (paired) {
          await writeFile(
            join(dir, `${migrationName}.down.SQL`),
            'DROP TABLE IF EXISTS sql_loader.example;'
          );
        }

        // Legacy loading reproduces the separate names recorded by the old
        // grouped loader for uppercase extensions.
        await runner({
          ...options,
          migrationLoaderStrategies: [
            { extensions: ['.sql'], loader: 'legacySql' },
          ],
        });
        const recorded = await history();
        expect(recorded.map(({ name }) => name)).toEqual(
          paired
            ? [`${migrationName}.down`, `${migrationName}.up`]
            : [`${migrationName}.up`]
        );

        await expect(runner(options)).rejects.toThrow(
          `Not run migration ${migrationName} is preceding already run migration`
        );
        expect(await history()).toEqual(recorded);

        // Apply the documented manual correction to these known history rows.
        await client.query(
          'UPDATE sql_loader.pgmigrations SET name = $1 WHERE name = $2',
          [migrationName, `${migrationName}.up`]
        );
        if (paired) {
          await client.query(
            'DELETE FROM sql_loader.pgmigrations WHERE name = $1',
            [`${migrationName}.down`]
          );
        }

        expect(await runner(options)).toEqual([]);
        expect(await history()).toEqual([
          {
            ...recorded.find(({ name }) => name === `${migrationName}.up`),
            name: migrationName,
          },
        ]);
        expect(
          (await client.query('SELECT id FROM sql_loader.example')).rows
        ).toEqual([{ id: 1 }]);

        if (!paired) {
          await writeFile(join(dir, `${migrationName}.down.SQL`), downSql);
        }
        const reverted = await runner({ ...options, direction: 'down' });
        expect(reverted.map(({ name }) => name)).toEqual([migrationName]);
        expect(await tableExists()).toBe(false);
        expect(await history()).toEqual([]);
      }
    );
  }
);
