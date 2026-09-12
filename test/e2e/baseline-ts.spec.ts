import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
} from 'vitest';
import {
  catalogFallbacks,
  countReasons,
  fallbackComments,
  identityPattern,
} from '../integration/introspect/catalog';
import type { CliResult } from './utils';
import {
  createDatabase,
  databaseUrl,
  dumpSchema,
  loadFixture,
  loadSql,
  PG_VERSIONS,
  runCli,
  setupPostgresDatabase,
} from './utils';

/**
 * A frame of a stack trace, as Node.js prints it.
 */
const STACK_FRAME = /^ {4}at /m;

/**
 * The languages of `--format` that make a baseline of `pgm` calls.
 */
type Format = 'ts' | 'js';

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
  const dir = await mkdtemp(join(tmpdir(), 'pgm-e2e-baseline-ts-'));
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
 * Checks that a `baseline --format` run succeeded the way a user sees it: exit
 * code 0, exactly one new migration of that language in the migrations
 * directory, the lines that say what to do with it on stdout, the note that
 * the format is experimental, and a header with the `--fake` command.
 *
 * @param result The `baseline` run.
 * @param cwd The directory it ran in.
 * @param dir The migrations directory it was given with `-m`.
 * @param format The `--format` it was given.
 *
 * @returns The migration name (the file name without its extension) and the
 * content of the file.
 */
async function expectBaselineWritten(
  result: CliResult,
  cwd: string,
  dir: string,
  format: Format
): Promise<{ readonly name: string; readonly content: string }> {
  expect(result.code, result.stderr).toBe(0);

  const files = await migrationFiles(join(cwd, dir));
  expect(files).toEqual([
    expect.stringMatching(new RegExp(String.raw`^\d+_baseline\.${format}$`)),
  ]);
  const name = files[0].slice(0, -`.${format}`.length);

  expect(result.stdout).toContain(
    [
      `> Wrote ${join(dir, `${name}.${format}`)}`,
      '> On databases that already have this schema, record it without running it:',
      `>   ${fakeCommand(name, dir)}`,
      '> Blank databases run it with a normal `node-pg-migrate up`.',
    ].join('\n')
  );
  expect(`${result.stdout}${result.stderr}`).toContain(
    `> Note: --format ${format} is experimental; review the generated migration.`
  );

  const content = await readFile(join(cwd, dir, files[0]), 'utf8');
  expect(content).toContain(fakeCommand(name, dir));
  expect(content).toMatch(/experimental/i);

  return { name, content };
}

/**
 * Checks that a run was refused with a message for the user: exit code 1 and
 * a message on stderr, without a stack trace or the usage that command-line
 * parsing errors print.
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
  expect(result.stderr).not.toContain('Usage:');
}

/**
 * Writes an ordinary TypeScript migration that sorts after the baseline and
 * adds a column to one of the tables the baseline creates.
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
    join(dir, `${name}.ts`),
    [
      "import type { MigrationBuilder } from 'node-pg-migrate';",
      '',
      'export const up = (pgm: MigrationBuilder): void => {',
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
 * TypeScript migration, run `up` on the source (only the new migration runs)
 * and on a blank database (both run), and compare the two.
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

/**
 * The `> Warning:` lines of a run.
 *
 * @param result The run.
 *
 * @returns The lines of stderr that start with `> Warning:`.
 */
function warnings(result: CliResult): string[] {
  return result.stderr
    .split('\n')
    .filter((line) => line.startsWith('> Warning:'));
}

describe.each(PG_VERSIONS)(
  'baseline --format ts|js (PG %s)',
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

    it.each([
      { fixture: 'chinook', table: 'artist', options: ['--strict'] },
      { fixture: 'pagila', table: 'actor', options: [] },
    ] as const)(
      'adopts a $fixture database with --format ts',
      async ({ fixture, table, options }) => {
        const source = await newDatabase(container, 'source');
        await loadFixture(container, source, fixture);
        // Chinook needs no raw SQL, so it can be strict; Pagila's partitions
        // and aggregate do.
        const fallbacks = await catalogFallbacks(container, source);
        const cwd = await tempDir();

        const result = await runCli(
          ['baseline', '--format', 'ts', ...options, '-m', 'migrations'],
          { cwd, env: { DATABASE_URL: databaseUrl(container, source) } }
        );

        const { name, content } = await expectBaselineWritten(
          result,
          cwd,
          'migrations',
          'ts'
        );
        expect(countReasons(fallbackComments(content))).toEqual(
          countReasons(fallbacks.map(({ reason }) => reason))
        );
        // One warning sums the fallbacks up with their count, when there are
        // any.
        const summaries = Math.min(fallbacks.length, 1);
        const count = new RegExp(String.raw`\b${fallbacks.length}\b`);
        expect(warnings(result)).toHaveLength(summaries);
        expect(
          warnings(result).filter((line) => count.test(line))
        ).toHaveLength(summaries);
        await expectAdoption(container, {
          source,
          cwd,
          dir: 'migrations',
          name,
          table,
        });
      }
    );

    it('writes a JavaScript migration with --format js that up applies', async () => {
      const source = await newDatabase(container, 'source');
      await loadFixture(container, source, 'chinook');
      const cwd = await tempDir();

      const result = await runCli(
        ['baseline', '--format', 'js', '-m', 'migrations'],
        { cwd, env: { DATABASE_URL: databaseUrl(container, source) } }
      );

      const { name } = await expectBaselineWritten(
        result,
        cwd,
        'migrations',
        'js'
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

    it('refuses --format ts together with --from-file', async () => {
      const database = await newDatabase(container, 'target');
      const cwd = await tempDir();
      await writeFile(
        join(cwd, 'schema.sql'),
        'CREATE TABLE public.t (id integer);\n'
      );

      const result = await runCli(
        [
          'baseline',
          '--format',
          'ts',
          '--from-file',
          'schema.sql',
          '-m',
          'migrations',
        ],
        { cwd, env: { DATABASE_URL: databaseUrl(container, database) } }
      );

      expectRefusal(result, ['--format', '--from-file']);
      expect(await migrationFiles(join(cwd, 'migrations'))).toEqual([]);
    });

    it('refuses --strict on Pagila, listing every object that needs raw SQL', async () => {
      const source = await newDatabase(container, 'source');
      await loadFixture(container, source, 'pagila');
      const fallbacks = await catalogFallbacks(container, source);
      const cwd = await tempDir();

      const result = await runCli(
        ['baseline', '--format', 'ts', '--strict', '-m', 'migrations'],
        { cwd, env: { DATABASE_URL: databaseUrl(container, source) } }
      );

      expectRefusal(result, [
        ...fallbacks.map(({ identity }) => identityPattern(identity)),
        ...new Set(fallbacks.map(({ reason }) => reason)),
      ]);
      expect(await migrationFiles(join(cwd, 'migrations'))).toEqual([]);
    });

    it('refuses identifiers that decamelize would rename', async () => {
      const source = await newDatabase(container, 'source');
      // Its only identifier with an uppercase letter: decamelize would turn
      // it into legacy_customer.
      await loadSql(
        container,
        source,
        'CREATE TABLE public."LegacyCustomer" (id integer, name text);'
      );
      const cwd = await tempDir();
      await writeFile(
        join(cwd, 'config.json'),
        `${JSON.stringify({ decamelize: true })}\n`
      );

      const result = await runCli(
        ['baseline', '--format', 'ts', '-f', 'config.json', '-m', 'migrations'],
        { cwd, env: { DATABASE_URL: databaseUrl(container, source) } }
      );

      expectRefusal(result, ['decamelize', 'LegacyCustomer']);
      expect(await migrationFiles(join(cwd, 'migrations'))).toEqual([]);
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
      // The casts that CREATE CAST made (090_create_cast.js).
      const [casts] = await query(
        container,
        source,
        `SELECT count(*) FROM pg_catalog.pg_cast AS c
         WHERE c.oid >= 16384 AND NOT EXISTS (
           SELECT FROM pg_catalog.pg_depend AS d
           WHERE d.classid = 'pg_catalog.pg_cast'::pg_catalog.regclass AND d.objid = c.oid AND d.deptype IN ('e', 'i')
         )`
      );
      expect(Number(casts)).toBeGreaterThan(0);
      const cwd = await tempDir();

      const result = await runCli(
        ['baseline', '--format', 'ts', '-m', 'db/migrations'],
        { cwd, env }
      );

      const { name, content } = await expectBaselineWritten(
        result,
        cwd,
        'db/migrations',
        'ts'
      );
      // They come back with createCast, not as raw SQL.
      expect(content.match(/\bpgm\.createCast\(/g) ?? []).toHaveLength(
        Number(casts)
      );
      expect(content).not.toMatch(/CREATE CAST/i);
      await expectAdoption(container, {
        source,
        cwd,
        dir: 'db/migrations',
        name,
        table: 't1',
      });
    });
  }
);
