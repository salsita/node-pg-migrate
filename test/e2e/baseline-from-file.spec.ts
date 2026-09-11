import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
  PG_VERSIONS,
  runCli,
  setupPostgresDatabase,
} from './utils';

const ADVERSARIAL_DIR = resolve(
  import.meta.dirname,
  '../baseline/fixtures/adversarial'
);

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
 * The tables of the Chinook fixture, which all have a few rows.
 */
const CHINOOK_TABLES: ReadonlyArray<string> = [
  'album',
  'artist',
  'customer',
  'employee',
  'genre',
  'invoice',
  'invoice_line',
  'media_type',
  'playlist',
  'playlist_track',
  'track',
];

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
 * Dumps the schema of a database the way a user would before running
 * `baseline --from-file`: `pg_dump --schema-only --no-owner --no-privileges`
 * of the server's own version, run inside the container.
 *
 * @param container The PostgreSQL container.
 * @param database The database to dump.
 *
 * @returns What `pg_dump` printed.
 */
async function pgDump(
  container: StartedPostgreSqlContainer,
  database: string
): Promise<string> {
  const res = await container.exec([
    'pg_dump',
    '-U',
    container.getUsername(),
    '-d',
    database,
    '--schema-only',
    '--no-owner',
    '--no-privileges',
  ]);
  if (res.exitCode !== 0) {
    throw new Error(`pg_dump failed for "${database}": ${res.stderr}`);
  }

  return res.stdout;
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
 *
 * @returns The command, for the `migrations` directory.
 */
function fakeCommand(name: string): string {
  return `node-pg-migrate up ${name} --fake`;
}

/**
 * Checks that a `baseline` run succeeded the way a user sees it: exit code 0,
 * exactly one new SQL migration in `<cwd>/migrations`, and the lines that say
 * what to do with it on stdout.
 *
 * @param result The `baseline` run, with `-m migrations`.
 * @param cwd The directory it ran in.
 * @param suffix The migration name after its prefix.
 *
 * @returns The migration name (the file name without `.sql`).
 */
async function expectBaselineWritten(
  result: CliResult,
  cwd: string,
  suffix = 'baseline'
): Promise<string> {
  expect(result.code, result.stderr).toBe(0);

  const files = await migrationFiles(join(cwd, 'migrations'));
  expect(files).toEqual([
    expect.stringMatching(new RegExp(String.raw`^\d+_${suffix}\.sql$`)),
  ]);
  const name = files[0].slice(0, -'.sql'.length);

  expect(result.stdout).toContain(
    [
      `> Wrote ${join('migrations', `${name}.sql`)}`,
      '> On databases that already have this schema, record it without running it:',
      `>   ${fakeCommand(name)}`,
      '> Blank databases run it with a normal `node-pg-migrate up`.',
    ].join('\n')
  );

  return name;
}

/**
 * Checks that a run was refused the way a `BaselineError` is reported: exit
 * code 1 and a message on stderr, without a stack trace.
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
 * @param cwd The directory with the `migrations` directory.
 * @param baselineName The baseline migration name.
 * @param table The table to add the column to.
 *
 * @returns The name of the new migration.
 */
async function writeFollowUp(
  cwd: string,
  baselineName: string,
  table: string
): Promise<string> {
  const prefix = BigInt(baselineName.slice(0, baselineName.indexOf('_')));
  const name = `${prefix + 1n}_add-adoption-note`;
  await writeFile(
    join(cwd, 'migrations', `${name}.js`),
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
 * @param options.name The baseline migration name.
 * @param options.table A table of the source for the follow-up migration.
 */
async function expectAdoption(
  container: StartedPostgreSqlContainer,
  options: {
    readonly source: string;
    readonly cwd: string;
    readonly name: string;
    readonly table: string;
  }
): Promise<void> {
  const { source, cwd, name, table } = options;
  const sourceEnv = { DATABASE_URL: databaseUrl(container, source) };

  // The command exactly as printed, without the program name.
  const fake = await runCli(fakeCommand(name).split(' ').slice(1), {
    cwd,
    env: sourceEnv,
  });
  expect(fake.code, fake.stderr).toBe(0);
  expect(await history(container, source)).toEqual([name]);

  const followUp = await writeFollowUp(cwd, name, table);

  const upSource = await runCli(['up'], { cwd, env: sourceEnv });
  expect(upSource.code, upSource.stderr).toBe(0);
  expect(upSource.stdout).not.toContain(`### MIGRATION ${name} (UP) ###`);
  expect(await history(container, source)).toEqual([name, followUp]);

  const blank = await newDatabase(container, 'blank');
  const upBlank = await runCli(['up'], {
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
  'baseline --from-file (PG %s)',
  (postgresVersion) => {
    let container: StartedPostgreSqlContainer;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${postgresVersion}-alpine`
      );
    });

    afterAll(async () => {
      await container?.stop();
    });

    /**
     * Creates a database with a fixture, dumps it into `<cwd>/schema.sql` and
     * runs `baseline --from-file schema.sql -m migrations` against it.
     *
     * @param fixture The fixture to load.
     *
     * @returns The source database, the directory and the `baseline` run.
     */
    async function baselineOf(fixture: 'pagila' | 'chinook'): Promise<{
      readonly source: string;
      readonly cwd: string;
      readonly result: CliResult;
    }> {
      const source = await newDatabase(container, 'source');
      await loadFixture(container, source, fixture);
      const cwd = await tempDir();
      await writeFile(join(cwd, 'schema.sql'), await pgDump(container, source));

      const result = await runCli(
        ['baseline', '--from-file', 'schema.sql', '-m', 'migrations'],
        { cwd, env: { DATABASE_URL: databaseUrl(container, source) } }
      );

      return { source, cwd, result };
    }

    it.each([
      { fixture: 'pagila', table: 'actor' },
      { fixture: 'chinook', table: 'artist' },
    ] as const)('adopts a $fixture database', async ({ fixture, table }) => {
      const { source, cwd, result } = await baselineOf(fixture);

      const name = await expectBaselineWritten(result, cwd);
      await expectAdoption(container, { source, cwd, name, table });
    });

    it('leaves the source intact when the baseline runs there without --fake', async () => {
      const { source, cwd, result } = await baselineOf('chinook');
      const name = await expectBaselineWritten(result, cwd);
      const env = { DATABASE_URL: databaseUrl(container, source) };
      const rowCounts = CHINOOK_TABLES.map(
        (table) => `SELECT '${table}', count(*) FROM public.${table}`
      ).join(' UNION ALL ');
      const schemaBefore = await dumpSchema(container, source);
      const rowsBefore = await query(container, source, rowCounts);

      const up = await runCli(['up'], { cwd, env });

      expect(up.code, up.stderr).toBe(1);
      expect(up.stderr).toContain('already exists');
      expect(await dumpSchema(container, source)).toBe(schemaBefore);
      expect(await query(container, source, rowCounts)).toEqual(rowsBefore);

      // Nothing was recorded, so the printed command still records it.
      const fake = await runCli(fakeCommand(name).split(' ').slice(1), {
        cwd,
        env,
      });
      expect(fake.code, fake.stderr).toBe(0);
      expect(fake.stdout).toContain(`### MIGRATION ${name} (UP) ###`);
      expect(await history(container, source)).toEqual([name]);
    });

    it('reads the dump from stdin without a database connection', async () => {
      const source = await newDatabase(container, 'source');
      await loadFixture(container, source, 'chinook');
      const cwd = await tempDir();

      const result = await runCli(
        [
          'baseline',
          'initial',
          'schema_v1',
          '--from-file',
          '-',
          '-m',
          'migrations',
        ],
        { cwd, env: NO_CONNECTION, input: await pgDump(container, source) }
      );

      // Name parts are joined like `create` joins them.
      const name = await expectBaselineWritten(
        result,
        cwd,
        'initial-schema-v1'
      );

      const blank = await newDatabase(container, 'blank');
      const up = await runCli(['up'], {
        cwd,
        env: { DATABASE_URL: databaseUrl(container, blank) },
      });
      expect(up.code, up.stderr).toBe(0);
      expect(await history(container, blank)).toEqual([name]);
      expect(await dumpSchema(container, blank)).toBe(
        await dumpSchema(container, source)
      );
    });

    it.each([
      {
        problem: 'a migration marker',
        file: 'marker-in-function-body.sql',
        fragments: ['line 30', '-- Up Migration'],
      },
      {
        problem: 'a psql meta-command',
        file: 'psql-connect.sql',
        fragments: ['line 23', String.raw`\connect app`, '--create'],
      },
      {
        problem: 'table data',
        file: 'copy-data.sql',
        fragments: ['line 54', '--schema-only'],
      },
      {
        problem: 'CREATE DATABASE',
        file: 'create-database.sql',
        fragments: ['--create'],
      },
      {
        problem: 'DROP statements',
        file: 'clean-dump.sql',
        fragments: ['--clean'],
      },
      {
        problem: 'the migrations table',
        file: 'migrations-table.sql',
        fragments: ['pgmigrations', /exclude/i],
      },
    ])('refuses a dump with $problem', async ({ file, fragments }) => {
      const database = await newDatabase(container, 'target');
      const cwd = await tempDir();

      const result = await runCli(
        [
          'baseline',
          '--from-file',
          join(ADVERSARIAL_DIR, file),
          '-m',
          'migrations',
        ],
        { cwd, env: { DATABASE_URL: databaseUrl(container, database) } }
      );

      expectRefusal(result, fragments);
      expect(await migrationFiles(join(cwd, 'migrations'))).toEqual([]);
    });

    it('refuses a migrations directory that already has a migration', async () => {
      const source = await newDatabase(container, 'source');
      await loadFixture(container, source, 'chinook');
      const cwd = await tempDir();
      await writeFile(join(cwd, 'schema.sql'), await pgDump(container, source));
      const dir = join(cwd, 'db', 'migrations');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, '.gitkeep'), '');
      await writeFile(
        join(dir, '1600000000000_first.sql'),
        '-- Up Migration\nCREATE TABLE first (id integer);\n'
      );

      const result = await runCli(
        ['baseline', '--from-file', 'schema.sql', '-m', 'db/migrations'],
        { cwd, env: { DATABASE_URL: databaseUrl(container, source) } }
      );

      // Dot files such as .gitkeep don't count.
      expectRefusal(result, ['db/migrations', /already has 1 file/]);
      expect(await migrationFiles(dir)).toEqual(['1600000000000_first.sql']);
    });

    it('refuses a database whose migrations table already records migrations', async () => {
      const source = await newDatabase(container, 'source');
      await loadFixture(container, source, 'chinook');
      const cwd = await tempDir();
      await writeFile(join(cwd, 'schema.sql'), await pgDump(container, source));
      const env = { DATABASE_URL: databaseUrl(container, source) };
      await mkdir(join(cwd, 'earlier'));
      await writeFile(
        join(cwd, 'earlier', '1600000000000_earlier.sql'),
        '-- Up Migration\nCREATE TABLE public.earlier (id integer);\n'
      );
      const earlier = await runCli(['up', '-m', 'earlier'], { cwd, env });
      expect(earlier.code, earlier.stderr).toBe(0);

      const result = await runCli(
        ['baseline', '--from-file', 'schema.sql', '-m', 'migrations'],
        { cwd, env }
      );

      expectRefusal(result, [
        '"public"."pgmigrations"',
        /already records 1 migration/,
      ]);
      expect(await migrationFiles(join(cwd, 'migrations'))).toEqual([]);
      expect(await history(container, source)).toEqual([
        '1600000000000_earlier',
      ]);
    });
  }
);
