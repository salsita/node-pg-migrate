import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { BaselineResult } from '../../../src';
import { baseline, BaselineError } from '../../../src';
import {
  createDatabase,
  databaseUrl,
  INTEGRATION_TIMEOUT,
  loadSql,
  PG_VERSIONS,
  setupPostgresDatabase,
} from '../utils';
import {
  listFiles,
  migrateUp,
  recordingLogger,
  rejectionOf,
  workDir,
} from './helpers';

// What baseline gives the pg_dump it runs, beyond the connection: the
// settings that decide how pg_dump writes string literals and characters,
// and the variables of the user's environment that would point pg_dump to
// another database.

/**
 * String literals with backslashes: a regular expression in a CHECK
 * constraint, a Windows path as a column default and a table comment. Every
 * literal is an `E''` string, so the script means the same with any
 * `standard_conforming_strings`.
 */
const BACKSLASH_SCHEMA = String.raw`
CREATE TABLE public.accounts (
  code text CHECK (code ~ E'^\\d+$'),
  path text DEFAULT E'C:\\data',
  opened timestamptz DEFAULT '2020-01-01 00:00:00+00'
);
COMMENT ON TABLE public.accounts IS E'back\\slash';
`;

/**
 * Text that is not ASCII: enum labels, a column default and a table comment.
 */
const ACCENTED_SCHEMA = `
CREATE TYPE public.mood AS ENUM ('café', 'naïve');
CREATE TABLE public.menu (
  item text DEFAULT 'crème brûlée',
  mood public.mood
);
COMMENT ON TABLE public.menu IS 'déjà vu';
`;

/**
 * The character a UTF-8 decoder puts in place of bytes that are not UTF-8.
 */
const REPLACEMENT_CHARACTER = '\uFFFD';

/**
 * The libpq variables the pg_dump shim of this spec passes on to the
 * pg_dump inside the container: the credentials (like `pgDumpShim()`), and
 * the variables this spec is about. `PGHOST` and `PGPORT` are not passed
 * on: inside the container, pg_dump connects through the local socket.
 */
const FORWARDED_VARIABLES: ReadonlyArray<string> = [
  'PGUSER',
  'PGPASSWORD',
  'PGDATABASE',
  'PGOPTIONS',
  'PGCLIENTENCODING',
  'PGSERVICE',
  'PGSERVICEFILE',
];

/**
 * One call of a {@link ForwardingShim}.
 */
interface ShimCall {
  /**
   * The arguments.
   */
  readonly argv: string[];

  /**
   * The environment variables whose name starts with `PG`.
   */
  readonly env: Readonly<Record<string, string>>;
}

/**
 * A pg_dump shim that records its calls, and runs the pg_dump inside the
 * container.
 */
interface ForwardingShim {
  /**
   * The path of the shim.
   */
  readonly bin: string;

  /**
   * Reads the calls made so far, in no particular order.
   */
  readonly calls: () => Promise<ShimCall[]>;
}

/**
 * Quotes a value for a POSIX shell.
 *
 * @param value The value.
 *
 * @returns The value in single quotes.
 */
function shellQuote(value: string): string {
  return `'${value.replaceAll("'", String.raw`'\''`)}'`;
}

/**
 * Splits a text into its lines.
 *
 * @param text The text, with a newline at the end of every line.
 *
 * @returns The lines, without their newlines.
 */
function linesOf(text: string): string[] {
  return text.endsWith('\n') ? text.slice(0, -1).split('\n') : [];
}

/**
 * Writes a pg_dump shim that records the arguments and the `PG*` variables
 * of each call, then runs the pg_dump inside the container with
 * {@link FORWARDED_VARIABLES}.
 *
 * @param container The PostgreSQL container.
 *
 * @returns The shim.
 */
async function forwardingShim(
  container: StartedPostgreSqlContainer
): Promise<ForwardingShim> {
  const dir = await workDir();
  const logDir = join(dir, 'calls');
  await mkdir(logDir);
  const bin = join(dir, 'pg_dump');
  const forwarded = FORWARDED_VARIABLES.map((name) => `-e ${name}`).join(' ');
  await writeFile(
    bin,
    [
      '#!/bin/sh',
      `log="$(mktemp ${shellQuote(join(logDir, 'call.XXXXXX'))})"`,
      `printf '%s\\n' "$@" > "$log"`,
      `env | grep '^PG' > "$log.env"`,
      `exec docker exec -i ${forwarded} ${container.getId()} pg_dump "$@"`,
      '',
    ].join('\n'),
    { mode: 0o755 }
  );

  return {
    bin,
    calls: async () => {
      const files = (await readdir(logDir)).filter(
        (file) => !file.endsWith('.env')
      );

      return Promise.all(
        files.map(async (file) => ({
          argv: linesOf(await readFile(join(logDir, file), 'utf8')),
          env: Object.fromEntries(
            linesOf(await readFile(join(logDir, `${file}.env`), 'utf8')).map(
              (line) => [
                line.slice(0, line.indexOf('=')),
                line.slice(line.indexOf('=') + 1),
              ]
            )
          ),
        }))
      );
    },
  };
}

/**
 * The calls of a shim that dumped a schema, leaving out `pg_dump --version`,
 * which connects to no database.
 *
 * @param shim The shim.
 *
 * @returns The calls with `--schema-only`.
 */
async function schemaDumps(shim: ForwardingShim): Promise<ShimCall[]> {
  return (await shim.calls()).filter(({ argv }) =>
    argv.includes('--schema-only')
  );
}

/**
 * Runs queries in a database through node-postgres, with
 * `standard_conforming_strings` on, so that the definitions it prints can be
 * compared across databases whatever their own setting is.
 *
 * @param url The database.
 * @param queries The queries, by name. Each returns one text column.
 *
 * @returns The values of each query, by name.
 */
async function textsOf(
  url: string,
  queries: Readonly<Record<string, string>>
): Promise<Record<string, string[]>> {
  const client = new pg.Client(url);
  await client.connect();
  try {
    await client.query('SET standard_conforming_strings = on');
    const texts: Record<string, string[]> = {};
    for (const [name, sql] of Object.entries(queries)) {
      const { rows } = await client.query<{ text: string }>(sql);
      texts[name] = rows.map((row) => row.text);
    }

    return texts;
  } finally {
    await client.end();
  }
}

/**
 * The literals of {@link BACKSLASH_SCHEMA}, as the database has them.
 *
 * @param url The database.
 *
 * @returns The CHECK constraint, the column defaults and the table comment.
 */
function backslashLiterals(url: string): Promise<Record<string, string[]>> {
  return textsOf(url, {
    check:
      "SELECT pg_get_constraintdef(oid) AS text FROM pg_constraint WHERE conrelid = 'public.accounts'::regclass AND contype = 'c'",
    defaults:
      "SELECT pg_get_expr(adbin, adrelid) AS text FROM pg_attrdef WHERE adrelid = 'public.accounts'::regclass ORDER BY adnum",
    comment:
      "SELECT obj_description('public.accounts'::regclass, 'pg_class') AS text",
  });
}

/**
 * The text of {@link ACCENTED_SCHEMA}, as the database has it.
 *
 * @param url The database.
 *
 * @returns The enum labels, the column default and the table comment.
 */
function accentedTexts(url: string): Promise<Record<string, string[]>> {
  return textsOf(url, {
    labels:
      "SELECT enumlabel AS text FROM pg_enum WHERE enumtypid = 'public.mood'::regtype ORDER BY enumsortorder",
    defaults:
      "SELECT pg_get_expr(adbin, adrelid) AS text FROM pg_attrdef WHERE adrelid = 'public.menu'::regclass ORDER BY adnum",
    comment:
      "SELECT obj_description('public.menu'::regclass, 'pg_class') AS text",
  });
}

describe.each(PG_VERSIONS)(
  'baseline() and the environment of pg_dump (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (postgresVersion) => {
    let container: StartedPostgreSqlContainer;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${postgresVersion}-alpine`
      );
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      await container?.stop();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    /**
     * Creates a database with an encoding, from `template0`.
     *
     * @param name The name of the new database.
     * @param encoding Its encoding, e.g. `LATIN1`.
     *
     * @returns Its connection URL.
     */
    async function databaseWithEncoding(
      name: string,
      encoding: string
    ): Promise<string> {
      await loadSql(
        container,
        container.getDatabase(),
        `CREATE DATABASE ${name} ENCODING '${encoding}' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;`
      );

      return databaseUrl(container, name);
    }

    /**
     * Runs baseline with the pg_dump of the container, with environment
     * variables of the user set while it runs (and only then: node-postgres
     * reads some of them too).
     *
     * @param url The database.
     * @param userEnv The variables of the user's environment.
     *
     * @returns The baseline, its SQL and the pg_dump shim it ran.
     */
    async function baselineWith(
      url: string,
      userEnv: Readonly<Record<string, string>> = {}
    ): Promise<{
      readonly result: BaselineResult;
      readonly sql: string;
      readonly dir: string;
      readonly shim: ForwardingShim;
    }> {
      const shim = await forwardingShim(container);
      const dir = join(await workDir(), 'migrations');
      for (const [name, value] of Object.entries(userEnv)) {
        vi.stubEnv(name, value);
      }

      let result: BaselineResult;
      try {
        result = await baseline({
          databaseUrl: url,
          dir,
          pgDump: shim.bin,
          logger: recordingLogger(),
        });
      } finally {
        vi.unstubAllEnvs();
      }

      return { result, sql: await readFile(result.path, 'utf8'), dir, shim };
    }

    describe('standard_conforming_strings', () => {
      it('gives a database whose standard_conforming_strings is off a baseline with the same literals on a blank database', async () => {
        await createDatabase(container, 'scs_off');
        await loadSql(
          container,
          container.getDatabase(),
          'ALTER DATABASE scs_off SET standard_conforming_strings = off;'
        );
        await loadSql(container, 'scs_off', BACKSLASH_SCHEMA);
        const source = databaseUrl(container, 'scs_off');

        const { sql, dir } = await baselineWith(source);
        await createDatabase(container, 'scs_off_blank');
        const blank = databaseUrl(container, 'scs_off_blank');
        await migrateUp(blank, dir);

        expect(await backslashLiterals(blank)).toEqual(
          await backslashLiterals(source)
        );
        expect(sql).not.toMatch(/standard_conforming_strings\s*=\s*off/);
      });

      it("keeps the user's PGOPTIONS, but writes standard literals even when they turn standard_conforming_strings off", async () => {
        await createDatabase(container, 'scs_pgoptions');
        await loadSql(container, 'scs_pgoptions', BACKSLASH_SCHEMA);
        const source = databaseUrl(container, 'scs_pgoptions');

        const { sql, dir } = await baselineWith(source, {
          PGOPTIONS:
            '-c standard_conforming_strings=off -c TimeZone=Asia/Tokyo',
        });
        await createDatabase(container, 'scs_pgoptions_blank');
        const blank = databaseUrl(container, 'scs_pgoptions_blank');
        await migrateUp(blank, dir);

        expect(await backslashLiterals(blank)).toEqual(
          await backslashLiterals(source)
        );
        // pg_dump leaves the time zone to the session, so the user's TimeZone
        // shows in the timestamptz default.
        expect(sql).toContain("'2020-01-01 09:00:00+09'");
      });
    });

    describe('encodings', () => {
      it('gives a LATIN1 database a UTF-8 baseline with the same text on a blank database', async () => {
        const source = await databaseWithEncoding('latin1_source', 'LATIN1');
        await loadSql(
          container,
          'latin1_source',
          `SET client_encoding = 'UTF8';\n${ACCENTED_SCHEMA}`
        );

        const { sql, dir } = await baselineWith(source);
        await createDatabase(container, 'latin1_blank');
        const blank = databaseUrl(container, 'latin1_blank');
        await migrateUp(blank, dir);

        expect(await accentedTexts(blank)).toEqual(await accentedTexts(source));
        expect(sql).not.toContain(REPLACEMENT_CHARACTER);
        expect(sql).toContain("'café'");
      });

      it('writes a UTF-8 baseline when the user has PGCLIENTENCODING=LATIN1', async () => {
        await createDatabase(container, 'client_latin1');
        await loadSql(container, 'client_latin1', ACCENTED_SCHEMA);
        const source = databaseUrl(container, 'client_latin1');

        const { sql, dir } = await baselineWith(source, {
          PGCLIENTENCODING: 'LATIN1',
        });
        await createDatabase(container, 'client_latin1_blank');
        const blank = databaseUrl(container, 'client_latin1_blank');
        await migrateUp(blank, dir);

        expect(await accentedTexts(blank)).toEqual(await accentedTexts(source));
        expect(sql).not.toContain(REPLACEMENT_CHARACTER);
        expect(sql).toContain("'crème brûlée'");
      });

      it('refuses a SQL_ASCII database that holds bytes that are not UTF-8, and writes nothing', async () => {
        const source = await databaseWithEncoding('sql_ascii', 'SQL_ASCII');
        // In SQL_ASCII, '\xe9' is the single byte 0xE9 (é in LATIN1).
        await loadSql(
          container,
          'sql_ascii',
          String.raw`CREATE TABLE public.menu (item text DEFAULT E'caf\xe9');`
        );
        const shim = await forwardingShim(container);
        const dir = join(await workDir(), 'migrations');

        const error = await rejectionOf(
          baseline({
            databaseUrl: source,
            dir,
            pgDump: shim.bin,
            logger: recordingLogger(),
          })
        );

        expect(error).toBeInstanceOf(BaselineError);
        const { code, message } = error as BaselineError;
        // pg_dump fails when the server cannot convert the bytes to UTF-8;
        // UTF-8 decoding refuses them otherwise.
        expect(['PG_DUMP_FAILED', 'NOT_UTF8']).toContain(code);
        expect(message).toMatch(/UTF-?8/);
        expect(await listFiles(dir)).toEqual([]);
      });

      it('refuses a dump file that pg_dump wrote in LATIN1, and writes nothing (NOT_UTF8)', async () => {
        await databaseWithEncoding('latin1_file', 'LATIN1');
        await loadSql(
          container,
          'latin1_file',
          `SET client_encoding = 'UTF8';\n${ACCENTED_SCHEMA}`
        );
        // `exec` returns the output as text, which would replace the LATIN1
        // bytes: base64 carries them through.
        const res = await container.exec([
          'sh',
          '-c',
          'set -o pipefail; pg_dump -U "$1" -d latin1_file --schema-only --no-owner --no-privileges | base64',
          'sh',
          container.getUsername(),
        ]);
        expect(res.exitCode, res.stderr).toBe(0);
        const work = await workDir();
        const fromFile = join(work, 'schema.sql');
        await writeFile(fromFile, Buffer.from(res.stdout, 'base64'));
        const dir = join(work, 'migrations');

        const error = await rejectionOf(
          baseline({ fromFile, dir, logger: recordingLogger() })
        );

        expect(error).toBeInstanceOf(BaselineError);
        expect(error).toMatchObject({ code: 'NOT_UTF8' });
        const { message } = error as BaselineError;
        expect(message).toContain('UTF-8');
        expect(message).toContain('--encoding=UTF8');
        expect(await listFiles(dir)).toEqual([]);
      });
    });

    describe('the database pg_dump connects to', () => {
      it('dumps the database of the connection even when PGSERVICE names another one', async () => {
        await createDatabase(container, 'service_checked');
        await loadSql(
          container,
          'service_checked',
          'CREATE TABLE public.only_in_checked (id integer);'
        );
        await createDatabase(container, 'service_other');
        await loadSql(
          container,
          'service_other',
          'CREATE TABLE public.only_in_other (id integer);'
        );
        const serviceFile = `/tmp/pgm-service-${randomUUID()}.conf`;
        await container.copyContentToContainer([
          {
            content: '[reporting]\ndbname=service_other\n',
            target: serviceFile,
          },
        ]);

        const { sql, shim } = await baselineWith(
          databaseUrl(container, 'service_checked'),
          { PGSERVICE: 'reporting', PGSERVICEFILE: serviceFile }
        );

        expect(sql).toContain('CREATE TABLE public.only_in_checked');
        expect(sql).not.toContain('only_in_other');
        const dumps = await schemaDumps(shim);
        expect(dumps.length).toBeGreaterThan(0);
        for (const { env } of dumps) {
          expect(env).not.toHaveProperty('PGSERVICE');
          expect(env).not.toHaveProperty('PGSERVICEFILE');
        }
      });

      it('does not give pg_dump a PGHOSTADDR of the environment when the connection names a host', async () => {
        await createDatabase(container, 'hostaddr');
        await loadSql(
          container,
          'hostaddr',
          'CREATE TABLE public.widgets (id integer);'
        );

        const { sql, shim } = await baselineWith(
          databaseUrl(container, 'hostaddr'),
          { PGHOSTADDR: '203.0.113.7' }
        );

        expect(sql).toContain('CREATE TABLE public.widgets');
        const dumps = await schemaDumps(shim);
        expect(dumps.length).toBeGreaterThan(0);
        for (const { env } of dumps) {
          expect(env).not.toHaveProperty('PGHOSTADDR');
        }
      });
    });
  }
);
