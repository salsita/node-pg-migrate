import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import pg from 'pg';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
} from 'vitest';
import type { CliResult } from './utils';
import {
  createDatabase,
  databaseUrl,
  dumpSchema,
  loadFixture,
  loadSql,
  PG_VERSIONS,
  pgDumpShim,
  runCli,
  setupPostgresDatabase,
} from './utils';

/**
 * Environment of a CLI run without any database connection: no `DATABASE_URL`
 * and none of the libpq variables a connection could come from.
 */
const NO_CONNECTION: NodeJS.ProcessEnv = {
  DATABASE_URL: undefined,
  PGHOST: undefined,
  PGPORT: undefined,
  PGUSER: undefined,
  PGPASSWORD: undefined,
  PGDATABASE: undefined,
};

/**
 * A frame of a stack trace, as Node.js prints it.
 */
const STACK_FRAME = /^ {4}at /m;

/**
 * How long the lock test holds its lock. It is well above the
 * `--lock-wait-timeout` it passes (1s) and below the default (10s): a baseline
 * that kept waiting would get the lock once it is released and succeed.
 */
const RELEASE_LOCK_AFTER_MS = 9000;

let databaseCount = 0;

/**
 * Creates a database with a name no other test uses.
 *
 * @param container The PostgreSQL container.
 * @param prefix The start of the name, e.g. `source`.
 *
 * @returns The name of the new database.
 */
async function newDatabase(
  container: StartedPostgreSqlContainer,
  prefix: string
): Promise<string> {
  databaseCount += 1;
  const name = `${prefix}_${databaseCount}`;
  await createDatabase(container, name);

  return name;
}

/**
 * Creates a temporary directory that is removed when the current test
 * finishes.
 *
 * @returns The path of the directory.
 */
async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pgm-e2e-baseline-'));
  onTestFinished(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  return dir;
}

/**
 * Runs a query with `psql` inside the container.
 *
 * @param container The PostgreSQL container.
 * @param database The database to query.
 * @param sql The query.
 *
 * @returns The rows, one line each (`psql -At`).
 */
async function query(
  container: StartedPostgreSqlContainer,
  database: string,
  sql: string
): Promise<string[]> {
  const res = await container.exec([
    'psql',
    '-X',
    '-At',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    container.getUsername(),
    '-d',
    database,
    '-c',
    sql,
  ]);
  if (res.exitCode !== 0) {
    throw new Error(`query failed in "${database}": ${res.stderr}`);
  }

  return res.stdout.split('\n').filter(Boolean);
}

/**
 * The migrations a database has recorded, in the order they ran.
 *
 * @param container The PostgreSQL container.
 * @param database The database.
 *
 * @returns The names in `public.pgmigrations`.
 */
function history(
  container: StartedPostgreSqlContainer,
  database: string
): Promise<string[]> {
  return query(
    container,
    database,
    'SELECT name FROM public.pgmigrations ORDER BY id'
  );
}

/**
 * The files of a directory, without the ones whose name starts with a dot.
 *
 * @param dir The directory.
 *
 * @returns The file names in order, or none when the directory is missing.
 */
async function migrationFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir))
      .filter((file) => !file.startsWith('.'))
      .toSorted();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

/**
 * The command a baseline prints for recording it without running it.
 *
 * @param name The migration name.
 * @param dir The migrations directory, as given to `-m`.
 *
 * @returns The command.
 */
function fakeCommand(name: string, dir: string): string {
  const command = `node-pg-migrate up ${name} --fake`;

  return dir === 'migrations' ? command : `${command} -m ${dir}`;
}

/**
 * The arguments of a plain `node-pg-migrate up` for a migrations directory.
 *
 * @param dir The migrations directory, as given to `-m`.
 *
 * @returns The arguments.
 */
function upArgs(dir: string): string[] {
  return dir === 'migrations' ? ['up'] : ['up', '-m', dir];
}

/**
 * Checks that a `baseline` run succeeded the way a user sees it: exit code 0,
 * exactly one new SQL migration in the migrations directory, and the lines
 * that say what to do with it on stdout.
 *
 * @param result The `baseline` run.
 * @param cwd The directory it ran in.
 * @param dir The migrations directory it was given with `-m`.
 *
 * @returns The migration name (the file name without `.sql`).
 */
async function expectBaselineWritten(
  result: CliResult,
  cwd: string,
  dir: string
): Promise<string> {
  expect(result.code, result.stderr).toBe(0);

  const files = await migrationFiles(join(cwd, dir));
  expect(files).toEqual([expect.stringMatching(/^\d+_baseline\.sql$/)]);
  const name = files[0].slice(0, -'.sql'.length);

  expect(result.stdout).toContain(
    [
      `> Wrote ${join(dir, `${name}.sql`)}`,
      '> On databases that already have this schema, record it without running it:',
      `>   ${fakeCommand(name, dir)}`,
      '> Blank databases run it with a normal `node-pg-migrate up`.',
    ].join('\n')
  );

  return name;
}

/**
 * Checks that a run was refused with a message for the user: exit code 1 and
 * a message on stderr, without a stack trace.
 *
 * @param result The run.
 * @param fragments What the message must contain: text, or a pattern.
 */
function expectRefusal(
  result: CliResult,
  fragments: ReadonlyArray<string | RegExp>
): void {
  expect(result.code, result.stderr).toBe(1);
  for (const fragment of fragments) {
    expect(result.stderr).toMatch(fragment);
  }

  expect(result.stderr).not.toMatch(STACK_FRAME);
  expect(result.stderr).not.toContain('BaselineError');
}

/**
 * Writes an ordinary migration that sorts after the baseline and adds a
 * column to one of the tables the baseline creates.
 *
 * @param dir The migrations directory.
 * @param baselineName The baseline migration name.
 * @param table The table to add the column to.
 *
 * @returns The name of the new migration.
 */
async function writeFollowUp(
  dir: string,
  baselineName: string,
  table: string
): Promise<string> {
  const prefix = BigInt(baselineName.slice(0, baselineName.indexOf('_')));
  const name = `${prefix + 1n}_add-adoption-note`;
  await writeFile(
    join(dir, `${name}.js`),
    [
      'export const up = (pgm) => {',
      `  pgm.addColumn('${table}', { adoption_note: { type: 'text' } });`,
      '};',
      '',
    ].join('\n')
  );

  return name;
}

/**
 * The rest of the adoption story once `baseline` wrote its migration: record
 * it on the source with the printed `--fake` command, add an ordinary
 * migration, run `up` on the source (only the new migration runs) and on a
 * blank database (both run), and compare the two.
 *
 * @param container The PostgreSQL container.
 * @param options The story so far.
 * @param options.source The database the baseline was made from.
 * @param options.cwd The directory `baseline` ran in.
 * @param options.dir The migrations directory given to `baseline`.
 * @param options.name The baseline migration name.
 * @param options.table A table of the source for the follow-up migration.
 */
async function expectAdoption(
  container: StartedPostgreSqlContainer,
  options: {
    readonly source: string;
    readonly cwd: string;
    readonly dir: string;
    readonly name: string;
    readonly table: string;
  }
): Promise<void> {
  const { source, cwd, dir, name, table } = options;
  const sourceEnv = { DATABASE_URL: databaseUrl(container, source) };

  // The command exactly as printed, without the program name.
  const fake = await runCli(fakeCommand(name, dir).split(' ').slice(1), {
    cwd,
    env: sourceEnv,
  });
  expect(fake.code, fake.stderr).toBe(0);
  expect(await history(container, source)).toEqual([name]);

  const followUp = await writeFollowUp(join(cwd, dir), name, table);

  const upSource = await runCli(upArgs(dir), { cwd, env: sourceEnv });
  expect(upSource.code, upSource.stderr).toBe(0);
  expect(upSource.stdout).not.toContain(`### MIGRATION ${name} (UP) ###`);
  expect(await history(container, source)).toEqual([name, followUp]);

  const blank = await newDatabase(container, 'blank');
  const upBlank = await runCli(upArgs(dir), {
    cwd,
    env: { DATABASE_URL: databaseUrl(container, blank) },
  });
  expect(upBlank.code, upBlank.stderr).toBe(0);
  expect(await history(container, blank)).toEqual([name, followUp]);

  expect(await dumpSchema(container, blank)).toBe(
    await dumpSchema(container, source)
  );
}

describe.each(PG_VERSIONS)(
  'baseline with pg_dump (PG %s)',
  (postgresVersion) => {
    let container: StartedPostgreSqlContainer;
    let pgDump: string;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${postgresVersion}-alpine`
      );
      pgDump = await pgDumpShim(container);
    });

    afterAll(async () => {
      await container?.stop();
      if (pgDump) {
        await rm(dirname(pgDump), { recursive: true, force: true });
      }
    });

    it.each([
      { fixture: 'pagila', table: 'actor' },
      { fixture: 'chinook', table: 'artist' },
    ] as const)('adopts a $fixture database', async ({ fixture, table }) => {
      const source = await newDatabase(container, 'source');
      await loadFixture(container, source, fixture);
      const cwd = await tempDir();

      const result = await runCli(
        ['baseline', '--pg-dump', pgDump, '-m', 'migrations'],
        { cwd, env: { DATABASE_URL: databaseUrl(container, source) } }
      );

      const name = await expectBaselineWritten(result, cwd, 'migrations');
      await expectAdoption(container, {
        source,
        cwd,
        dir: 'migrations',
        name,
        table,
      });
    });

    it("adopts a database built by this repository's test migrations", async () => {
      const source = await newDatabase(container, 'dogfood');
      const env = { DATABASE_URL: databaseUrl(container, source) };
      // Like the Postgres Test workflow, from the repository root.
      const built = await runCli(['up', '-m', 'test/migrations'], { env });
      expect(built.code, built.stderr).toBe(0);
      // Without that history, the database looks like one node-pg-migrate never
      // managed. The roles those migrations create belong to the whole server,
      // so the blank database of the story has them too.
      await loadSql(container, source, 'DROP TABLE public.pgmigrations;');
      const cwd = await tempDir();

      const result = await runCli(
        ['baseline', '--pg-dump', pgDump, '-m', 'db/migrations'],
        { cwd, env }
      );

      const name = await expectBaselineWritten(result, cwd, 'db/migrations');
      await expectAdoption(container, {
        source,
        cwd,
        dir: 'db/migrations',
        name,
        table: 't1',
      });
    });

    it('says what to do when pg_dump is missing', async () => {
      const database = await newDatabase(container, 'target');
      const cwd = await tempDir();

      const result = await runCli(
        ['baseline', '--pg-dump', '/does/not/exist', '-m', 'migrations'],
        { cwd, env: { DATABASE_URL: databaseUrl(container, database) } }
      );

      expectRefusal(result, ['/does/not/exist', '--pg-dump', '--from-file']);
      expect(await migrationFiles(join(cwd, 'migrations'))).toEqual([]);
    });

    it('refuses a pg_dump older than the server', async () => {
      const database = await newDatabase(container, 'target');
      const [serverVersion] = await query(
        container,
        database,
        'SHOW server_version'
      );
      const oldPgDump = await pgDumpShim(container, { reportVersion: '13.0' });
      onTestFinished(async () => {
        await rm(dirname(oldPgDump), { recursive: true, force: true });
      });
      const cwd = await tempDir();

      const result = await runCli(
        ['baseline', '--pg-dump', oldPgDump, '-m', 'migrations'],
        { cwd, env: { DATABASE_URL: databaseUrl(container, database) } }
      );

      expectRefusal(result, ['13.0', serverVersion.split(' ')[0]]);
      expect(await migrationFiles(join(cwd, 'migrations'))).toEqual([]);
    });

    it('gives up when another session holds a lock', async () => {
      const database = await newDatabase(container, 'locked');
      await loadSql(
        container,
        database,
        'CREATE TABLE public.busy (id integer PRIMARY KEY);'
      );
      const cwd = await tempDir();
      const holder = new pg.Client({
        connectionString: databaseUrl(container, database),
      });
      await holder.connect();

      try {
        await holder.query('BEGIN');
        await holder.query('LOCK TABLE public.busy IN ACCESS EXCLUSIVE MODE');
        const release = setTimeout(() => {
          holder.query('ROLLBACK').catch(() => null);
        }, RELEASE_LOCK_AFTER_MS);

        const result = await runCli(
          [
            'baseline',
            '--pg-dump',
            pgDump,
            '--lock-wait-timeout',
            '1s',
            '-m',
            'migrations',
          ],
          { cwd, env: { DATABASE_URL: databaseUrl(container, database) } }
        );
        clearTimeout(release);

        expectRefusal(result, [/lock/i, '--lock-wait-timeout']);
        expect(await migrationFiles(join(cwd, 'migrations'))).toEqual([]);
      } finally {
        await holder.end();
      }
    });

    it('needs a database connection, like up', async () => {
      const cwd = await tempDir();
      const up = await runCli(['up'], { cwd, env: NO_CONNECTION });
      const upError = up.stderr
        .split('\n')
        .find((line) => line.includes('environment variable is not set'));
      expect(up.code, up.stderr).toBe(1);
      expect(upError).toBeDefined();

      const result = await runCli(
        ['baseline', '--pg-dump', pgDump, '-m', 'migrations'],
        { cwd, env: NO_CONNECTION }
      );

      expectRefusal(result, [String(upError)]);
      expect(await migrationFiles(join(cwd, 'migrations'))).toEqual([]);
    });

    it.each([
      { flag: '--include-schema', schemas: ['kitchen', 'kitchen_audit'] },
      { flag: '--exclude-schema', schemas: ['Sink Área'] },
    ])('$flag limits what the baseline contains', async ({ flag, schemas }) => {
      // The kitchen sink has three schemas; both flags leave out the third.
      const source = await newDatabase(container, 'source');
      await loadFixture(container, source, 'kitchen-sink');
      const expected = await newDatabase(container, 'expected');
      await loadFixture(container, expected, 'kitchen-sink');
      await loadSql(container, expected, 'DROP SCHEMA "Sink Área" CASCADE;');
      const cwd = await tempDir();

      const result = await runCli(
        ['baseline', '--pg-dump', pgDump, flag, ...schemas, '-m', 'migrations'],
        { cwd, env: { DATABASE_URL: databaseUrl(container, source) } }
      );

      const name = await expectBaselineWritten(result, cwd, 'migrations');
      const blank = await newDatabase(container, 'blank');
      const up = await runCli(['up'], {
        cwd,
        env: { DATABASE_URL: databaseUrl(container, blank) },
      });
      expect(up.code, up.stderr).toBe(0);
      expect(await history(container, blank)).toEqual([name]);
      expect(await dumpSchema(container, blank)).toBe(
        await dumpSchema(container, expected)
      );
    });
  }
);
