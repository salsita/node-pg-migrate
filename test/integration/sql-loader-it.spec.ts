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
  }
);
