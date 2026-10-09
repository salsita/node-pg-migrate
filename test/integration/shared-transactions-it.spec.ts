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
import { runner } from '../../src';
import type { MigrationDirection } from '../../src/runner';
import {
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

// The Cockroach workflow supplies an explicit connection; ordinary integration runs use
// disposable PostgreSQL containers, without relying on DATABASE_URL or PG* settings.
const cockroachUrl = process.env.COCKROACH_URL;
const targets: Array<
  { name: string; url: string } | { name: string; version: string }
> = cockroachUrl
  ? [{ name: 'CockroachDB', url: cockroachUrl }]
  : PG_VERSIONS.map((version) => ({ name: `PG ${version}`, version }));
const schema = 'shared_transactions';
const first = '1000000000000_first';
const second = '1000000000001_second';

describe.each(targets)(
  'shared transactions ($name)',
  { timeout: INTEGRATION_TIMEOUT },
  (target) => {
    let container: StartedPostgreSqlContainer | undefined;
    let databaseUrl: string;
    let observer: pg.Client;
    let client: pg.Client;
    let dir: string;

    async function autocommit() {
      const {
        rows: [{ setting }],
      } = await client.query<{ setting: string | null }>(
        "SELECT current_setting('autocommit_before_ddl', true) AS setting"
      );
      return setting;
    }

    async function setAutocommit(enabled: boolean) {
      if (await autocommit()) {
        await client.query(`SET autocommit_before_ddl = ${enabled}`);
      }
    }

    beforeAll(async () => {
      if ('url' in target) {
        databaseUrl = target.url;
      } else {
        container = await setupPostgresDatabase(
          `postgres:${target.version}-alpine`,
          'shared_transactions'
        );
        databaseUrl = container.getConnectionUri();
      }
      observer = new pg.Client(databaseUrl);
      await observer.connect();
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      if (observer) {
        await observer.end();
      }
      if (container) {
        await container.stop();
      }
    });

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'pgm-shared-transactions-'));
      client = new pg.Client(databaseUrl);
      await client.connect();
      await observer.query(`CREATE SCHEMA ${schema}`);
      await observer.query(
        `CREATE TABLE ${schema}.control (fail_up boolean, fail_down boolean)`
      );
      await observer.query(
        `INSERT INTO ${schema}.control VALUES (false, false)`
      );
      await observer.query(
        `CREATE TABLE ${schema}.events (id serial PRIMARY KEY, event text NOT NULL)`
      );
      await observer.query(
        `CREATE TABLE ${schema}.pgmigrations (id serial PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL)`
      );
      // Exercise the enabled setting even on versions where the server default is off.
      // PostgreSQL and older CockroachDB versions do not know this setting at all.
      await setAutocommit(true);
    });

    afterEach(async () => {
      await client.end();
      await observer.query(`DROP SCHEMA ${schema} CASCADE`);
      await rm(dir, { recursive: true, force: true });
    });

    function options(direction: MigrationDirection | 'redo') {
      return {
        dir,
        schema,
        migrationsSchema: schema,
        migrationsTable: 'pgmigrations',
        direction,
        count: Number.POSITIVE_INFINITY,
        singleTransaction: true,
        noLock: true,
        log: () => {},
      };
    }

    async function migrations(noTransaction = false) {
      const prefix = noTransaction ? 'pgm.noTransaction();' : '';
      await writeFile(
        join(dir, `${first}.cjs`),
        `exports.up = (pgm) => {
          ${prefix}
          pgm.createTable('first', { value: 'text' });
          pgm.sql("INSERT INTO ${schema}.events (event) VALUES ('first:up')");
        };
        exports.down = (pgm) => {
          pgm.dropTable('first');
          pgm.sql("INSERT INTO ${schema}.events (event) VALUES ('first:down')");
          pgm.sql('SELECT 1 / CASE WHEN fail_down THEN 0 ELSE 1 END FROM ${schema}.control');
        };`
      );
      await writeFile(
        join(dir, `${second}.cjs`),
        `exports.up = (pgm) => {
          pgm.createTable('second', { value: 'text' });
          pgm.sql("INSERT INTO ${schema}.events (event) VALUES ('second:up')");
          pgm.sql('SELECT 1 / CASE WHEN fail_up THEN 0 ELSE 1 END FROM ${schema}.control');
        };
        exports.down = (pgm) => {
          pgm.dropTable('second');
          pgm.sql("INSERT INTO ${schema}.events (event) VALUES ('second:down')");
        };`
      );
    }

    async function history() {
      return (
        await observer.query(
          `SELECT id, name, run_on FROM ${schema}.pgmigrations ORDER BY id`
        )
      ).rows;
    }

    async function events() {
      return (
        await observer.query<{ event: string }>(
          `SELECT event FROM ${schema}.events ORDER BY id`
        )
      ).rows.map(({ event }) => event);
    }

    async function tables() {
      return (
        await observer.query<{ table_name: string }>(
          'SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name',
          [schema]
        )
      ).rows.map(({ table_name }) => table_name);
    }

    async function expectReusable(setting: string | null) {
      expect((await client.query('SELECT true AS ready')).rows).toEqual([
        { ready: true },
      ]);
      expect(await autocommit()).toBe(setting);
    }

    async function seedData() {
      await observer.query(`INSERT INTO ${schema}.first VALUES ('keep first')`);
      await observer.query(
        `INSERT INTO ${schema}.second VALUES ('keep second')`
      );
      await observer.query(`TRUNCATE ${schema}.events`);
    }

    async function expectDataPreserved() {
      expect(
        (await observer.query(`SELECT value FROM ${schema}.first`)).rows
      ).toEqual([{ value: 'keep first' }]);
      expect(
        (await observer.query(`SELECT value FROM ${schema}.second`)).rows
      ).toEqual([{ value: 'keep second' }]);
    }

    it.each([true, false])(
      'rolls back prior migrations, DDL, data and history (autocommit=%s when available)',
      async (enabled) => {
        await setAutocommit(enabled);
        const setting = await autocommit();
        await migrations();
        await observer.query(`UPDATE ${schema}.control SET fail_up = true`);

        await expect(
          runner({ ...options('up'), dbClient: client })
        ).rejects.toMatchObject({ code: '22012' });

        expect(await history()).toEqual([]);
        expect(await events()).toEqual([]);
        expect(await tables()).toEqual(['control', 'events', 'pgmigrations']);
        await expectReusable(setting);
      }
    );

    it.each(['down', 'redo'] as const)(
      'restores existing schema, data and history after a failing %s',
      async (direction) => {
        const setting = await autocommit();
        await migrations();
        await runner({ ...options('up'), dbClient: client });
        await seedData();
        const before = await history();
        await observer.query(
          `UPDATE ${schema}.control SET ${direction === 'down' ? 'fail_down' : 'fail_up'} = true`
        );

        await expect(
          runner({ ...options(direction), dbClient: client })
        ).rejects.toMatchObject({ code: '22012' });

        expect(await history()).toEqual(before);
        expect(await events()).toEqual([]);
        await expectDataPreserved();
        await expectReusable(setting);
      }
    );

    it('restores the caller setting after successful up and down', async () => {
      const setting = await autocommit();
      await migrations();

      await runner({ ...options('up'), dbClient: client });
      expect((await history()).map(({ name }) => name)).toEqual([
        first,
        second,
      ]);
      expect(await events()).toEqual(['first:up', 'second:up']);
      await expectReusable(setting);

      await runner({ ...options('down'), dbClient: client });
      expect(await history()).toEqual([]);
      expect(await tables()).toEqual(['control', 'events', 'pgmigrations']);
      await expectReusable(setting);
    });

    it('keeps dry runs read-only and restores the caller setting', async () => {
      const setting = await autocommit();
      await migrations();

      await expect(
        runner({ ...options('up'), dbClient: client, dryRun: true })
      ).resolves.toHaveLength(2);

      expect(await history()).toEqual([]);
      expect(await events()).toEqual([]);
      expect(await tables()).toEqual(['control', 'events', 'pgmigrations']);
      await expectReusable(setting);
    });

    it('refuses direct dry-run DDL and restores the caller setting', async () => {
      const setting = await autocommit();
      await writeFile(
        join(dir, `${first}.cjs`),
        `exports.up = async (pgm) => {
          await pgm.db.query('CREATE TABLE ${schema}.direct_write (id integer)');
        };`
      );

      await expect(
        runner({ ...options('up'), dbClient: client, dryRun: true })
      ).rejects.toMatchObject({ cause: { code: '25006' } });

      expect(await history()).toEqual([]);
      expect(await events()).toEqual([]);
      expect(await tables()).toEqual(['control', 'events', 'pgmigrations']);
      await expectReusable(setting);
    });

    it('honors noTransaction as an explicit break in the shared transaction', async () => {
      const setting = await autocommit();
      await migrations(true);
      await observer.query(`UPDATE ${schema}.control SET fail_up = true`);

      await expect(
        runner({ ...options('up'), dbClient: client })
      ).rejects.toMatchObject({ code: '22012' });

      expect((await history()).map(({ name }) => name)).toEqual([first]);
      expect(await events()).toEqual(['first:up']);
      expect(await tables()).toEqual([
        'control',
        'events',
        'first',
        'pgmigrations',
      ]);
      await expectReusable(setting);
    });

    it.each([
      { mode: 'shared', singleTransaction: true, noTransaction: false },
      { mode: 'noTransaction', singleTransaction: true, noTransaction: true },
      { mode: 'per-migration', singleTransaction: false, noTransaction: false },
    ])(
      'handles a new-column backfill on an existing table ($mode)',
      async ({ singleTransaction, noTransaction }) => {
        const setting = await autocommit();
        await observer.query(
          `CREATE TABLE ${schema}.accounts (name text PRIMARY KEY)`
        );
        await observer.query(
          `INSERT INTO ${schema}.accounts VALUES ('existing')`
        );
        await writeFile(
          join(dir, `${first}.cjs`),
          `exports.up = (pgm) => {
            ${noTransaction ? 'pgm.noTransaction();' : ''}
            pgm.addColumns('accounts', { status: 'text' });
            pgm.sql("UPDATE ${schema}.accounts SET status = 'active'");
            pgm.alterColumn('accounts', 'status', { notNull: true });
          };`
        );

        // CockroachDB cannot use a newly added column on an existing table until commit.
        // With no shared transaction, an enabled DDL autocommit lets the backfill proceed;
        // older versions without that setting still require pgm.noTransaction().
        const fails =
          'url' in target &&
          !noTransaction &&
          (singleTransaction || setting === null);
        const outcome = await runner({
          ...options('up'),
          singleTransaction,
          dbClient: client,
        }).then(
          () => ({ applied: true }),
          (error: unknown) => ({ error })
        );

        expect(outcome).toMatchObject(
          fails ? { error: { code: '42703' } } : { applied: true }
        );
        expect((await history()).map(({ name }) => name)).toEqual(
          fails ? [] : [first]
        );
        expect(
          (await observer.query(`SELECT * FROM ${schema}.accounts`)).rows
        ).toEqual(
          fails
            ? [{ name: 'existing' }]
            : [{ name: 'existing', status: 'active' }]
        );
        expect(
          (
            await observer.query(
              "SELECT is_nullable FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'accounts' AND column_name = 'status'",
              [schema]
            )
          ).rows
        ).toEqual(fails ? [] : [{ is_nullable: 'NO' }]);
        await expectReusable(setting);
      }
    );

    it('also rolls back when the runner owns the connection', async () => {
      await migrations();
      await observer.query(`UPDATE ${schema}.control SET fail_up = true`);

      await expect(
        runner({ ...options('up'), databaseUrl })
      ).rejects.toMatchObject({ code: '22012' });

      expect(await history()).toEqual([]);
      expect(await events()).toEqual([]);
      expect(await tables()).toEqual(['control', 'events', 'pgmigrations']);
    });
  }
);
