import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { renderHeader } from '../../../src/baseline/core/header';
import { sanitizeDump } from '../../../src/baseline/core/sanitize';
import { BaselineError } from '../../../src/baseline/errors';
import type { DumpStats, SanitizeOptions } from '../../../src/baseline/types';
import type { MigrationBuilder } from '../../../src/migrationBuilder';
import { getActions } from '../../../src/sqlMigration';
import { generateDumpLike } from '../../fixtures/generate';
import {
  CAPTURED_DUMPS,
  countOf,
  DEFAULT_SANITIZE_OPTIONS,
  escapeRegExp,
  messageOf,
  readAdversarial,
  thrownBy,
} from '../helpers';

/**
 * The cleaned-up SQL of a dump.
 */
function sanitize(
  dump: string,
  options: SanitizeOptions = DEFAULT_SANITIZE_OPTIONS
): string {
  return sanitizeDump(dump, options).sql;
}

/**
 * The statement that saves the value a setting had before the baseline.
 */
function saveOf(name: string): string {
  return `SELECT pg_catalog.set_config('node_pg_migrate.${name}', pg_catalog.current_setting('${name}'), true);`;
}

/**
 * The statement that restores the value a setting had before the baseline.
 */
function restoreOf(name: string): string {
  return `SELECT pg_catalog.set_config('${name}', pg_catalog.current_setting('node_pg_migrate.${name}'), true);`;
}

/**
 * The source of a pattern for `SET LOCAL <name> = <value>;` (`TO` works as
 * well as `=`).
 */
function setLocalSource(name: string, value: string): string {
  return String.raw`SET LOCAL ${escapeRegExp(name)}(?:\s*=\s*|\s+TO\s+)${escapeRegExp(value)};`;
}

/**
 * A pattern for the given fragments in this order, with anything between
 * them. Strings are literal, regular expressions are used as they are.
 */
function inOrder(...fragments: ReadonlyArray<string | RegExp>): RegExp {
  return new RegExp(
    fragments
      .map((fragment) =>
        typeof fragment === 'string' ? escapeRegExp(fragment) : fragment.source
      )
      .join(String.raw`[\s\S]*?`)
  );
}

/**
 * Checks that the restores of `names` are the last statements of `sql`, in
 * this order, with nothing but whitespace between and after them.
 */
function restoresAtTheEnd(sql: string, names: ReadonlyArray<string>): boolean {
  const pattern = names
    .map((name) => String.raw`\s*${escapeRegExp(restoreOf(name))}`)
    .join('');

  return new RegExp(String.raw`${pattern}\s*$`).test(sql);
}

/**
 * The settings a pg_dump output `SET`s at the top level (one line each,
 * `SET <name> = <value>;`), in first-seen order, without the `*_timeout`
 * ones.
 */
function savedSettingsOf(dump: string): string[] {
  const names = [...dump.matchAll(/^SET (\w+) = .*;$/gm)].map(
    (match) => match[1] ?? ''
  );

  return [...new Set(names)].filter((name) => !name.endsWith('_timeout'));
}

/**
 * The non-blank lines of a pg_dump output that the sanitizer keeps: all but
 * the `\restrict` pair, the `search_path` reset, the top-level `SET`s and
 * `COMMENT ON EXTENSION` (pg_dump writes each of them on one line).
 */
function keptLinesOf(dump: string): string[] {
  return dump
    .split('\n')
    .filter(
      (line) =>
        line.trim() !== '' &&
        !/^\\(?:un)?restrict /.test(line) &&
        line !== "SELECT pg_catalog.set_config('search_path', '', false);" &&
        !/^SET \w+ = .*;$/.test(line) &&
        !line.startsWith('COMMENT ON EXTENSION ')
    );
}

/**
 * The non-blank lines of cleaned-up SQL without what the sanitizer adds: the
 * saves, `SET LOCAL`s and restores of the given settings.
 */
function originalLinesOf(sql: string, names: ReadonlyArray<string>): string[] {
  let rest = sql;
  for (const name of names) {
    rest = rest
      .replaceAll(saveOf(name), '')
      .replaceAll(restoreOf(name), '')
      .replaceAll(
        new RegExp(
          String.raw`SET LOCAL ${name}(?:\s*=\s*|\s+TO\s+)[^;\n]*;`,
          'g'
        ),
        ''
      );
  }

  return rest.split('\n').filter((line) => line.trim() !== '');
}

/**
 * Counts what a pg_dump output creates, without the sanitizer: pg_dump starts
 * every statement at the beginning of a line and writes
 * `ADD CONSTRAINT <name> <kind>` on a line of its own.
 */
function statsOf(dump: string): DumpStats {
  const count = (pattern: RegExp): number => [...dump.matchAll(pattern)].length;

  return {
    tables: count(/^CREATE (?:UNLOGGED )?TABLE /gm),
    indexes: count(/^CREATE (?:UNIQUE )?INDEX /gm),
    indexBackedConstraints: count(
      /^ {4}ADD CONSTRAINT (?:"(?:[^"]|"")*"|[^\s"]+) (?:PRIMARY KEY|UNIQUE|EXCLUDE)\b/gm
    ),
    sequences:
      count(/^CREATE SEQUENCE /gm) +
      count(/ ADD GENERATED (?:ALWAYS|BY DEFAULT) AS IDENTITY \($/gm),
    views: count(/^CREATE (?:OR REPLACE )?VIEW /gm),
    materializedViews: count(/^CREATE MATERIALIZED VIEW /gm),
  };
}

/**
 * The same counts from the other side: the `-- Name: …; Type: <kind>;`
 * comment pg_dump writes above each object.
 */
function tocStatsOf(dump: string): DumpStats {
  const count = (type: string): number =>
    [
      ...dump.matchAll(
        new RegExp(String.raw`^-- Name: [^\n]*; Type: ${type}; Schema: `, 'gm')
      ),
    ].length;

  return {
    tables: count('TABLE'),
    indexes: count('INDEX'),
    indexBackedConstraints: count('CONSTRAINT'),
    sequences: count('SEQUENCE'),
    views: count('VIEW'),
    materializedViews: count('MATERIALIZED VIEW'),
  };
}

/**
 * A dump saved as UTF-16LE with a byte order mark, the way Windows
 * PowerShell 5.1's `>` saves it, then read as UTF-8 like `readDumpFile()`
 * reads every dump.
 */
function savedAsUtf16(dump: string): string {
  return Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from(dump, 'utf16le'),
  ]).toString('utf8');
}

describe('sanitizeDump', () => {
  describe('R0: plain SQL text', () => {
    const pagila = CAPTURED_DUMPS.find((dump) => dump.name === 'pg18/pagila');
    if (pagila === undefined) {
      throw new Error('the captured dump pg18/pagila is missing');
    }

    it('refuses the custom-format archive of custom-format.dump, with the pg_restore command that turns it into SQL', () => {
      const error = thrownBy(() =>
        sanitizeDump(
          readAdversarial('custom-format.dump'),
          DEFAULT_SANITIZE_OPTIONS
        )
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'BINARY_DUMP' });
      expect(messageOf(error)).toContain('custom-format');
      expect(messageOf(error)).toContain('-Fc');
      expect(messageOf(error)).toContain(
        'pg_restore --schema-only --no-owner --no-privileges -f schema.sql'
      );
    });

    it('refuses the tar-format archive of tar-format.tar, with the pg_restore command that turns it into SQL', () => {
      const error = thrownBy(() =>
        sanitizeDump(
          readAdversarial('tar-format.tar'),
          DEFAULT_SANITIZE_OPTIONS
        )
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'BINARY_DUMP' });
      expect(messageOf(error)).toContain('tar-format');
      expect(messageOf(error)).toContain('-Ft');
      expect(messageOf(error)).toContain(
        'pg_restore --schema-only --no-owner --no-privileges -f schema.sql'
      );
    });

    it('refuses a compressed dump', () => {
      const error = thrownBy(() =>
        sanitizeDump(
          gzipSync(pagila.sql).toString('utf8'),
          DEFAULT_SANITIZE_OPTIONS
        )
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'BINARY_DUMP' });
      expect(messageOf(error)).toMatch(/compressed/i);
    });

    it('refuses a dump saved as UTF-16', () => {
      const error = thrownBy(() =>
        sanitizeDump(savedAsUtf16(pagila.sql), DEFAULT_SANITIZE_OPTIONS)
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'BINARY_DUMP' });
      expect(messageOf(error)).toContain('UTF-16');
    });

    it('refuses a dump with a NUL byte before looking at its statements', () => {
      const error = thrownBy(() =>
        sanitizeDump(
          'CREATE TABLE public.t (id integer);\n\\connect app\nSELECT 1;\0\n',
          DEFAULT_SANITIZE_OPTIONS
        )
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'BINARY_DUMP' });
    });

    it('keeps text in any language, and the character that stands for bytes that are not UTF-8', () => {
      const dump = "COMMENT ON TABLE public.t IS 'café, 日本語, 🐘 and �';\n";

      expect(sanitize(dump)).toBe(dump);
    });
  });

  describe('R1: psql meta-commands', () => {
    it('drops the \\restrict line and the \\unrestrict line with the same key', () => {
      expect(
        sanitize(
          '\\restrict abc123\nCREATE TABLE public.t (id integer);\n\\unrestrict abc123\n'
        )
      ).toBe('CREATE TABLE public.t (id integer);\n');
    });

    it('refuses the \\connect of psql-connect.sql, with its line', () => {
      const error = thrownBy(() =>
        sanitizeDump(
          readAdversarial('psql-connect.sql'),
          DEFAULT_SANITIZE_OPTIONS
        )
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'PSQL_META_COMMAND' });
      expect(messageOf(error)).toContain('line 23');
      expect(messageOf(error)).toContain('\\connect app');
      expect(messageOf(error)).toMatch(/psql/);
      expect(messageOf(error)).toContain('--create');
    });

    it.each([
      '\\set ON_ERROR_STOP on',
      '\\i other.sql',
      '\\! touch /tmp/pwned',
      '\\gexec',
      '\\c app',
    ])('refuses the meta-command %s, with its line', (command) => {
      const error = thrownBy(() =>
        sanitizeDump(
          `CREATE TABLE public.t (id integer);\n\n${command}\nCREATE TABLE public.u (id integer);\n`,
          DEFAULT_SANITIZE_OPTIONS
        )
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'PSQL_META_COMMAND' });
      expect(messageOf(error)).toContain('line 3');
      expect(messageOf(error)).toContain(command);
    });

    it.each([
      {
        name: 'a second \\restrict',
        dump: '\\restrict abc\nSELECT 1;\n\\restrict abc\n',
        line: 3,
      },
      {
        name: 'a \\unrestrict with another key',
        dump: '\\restrict abc\nSELECT 1;\n\\unrestrict xyz\n',
        line: 3,
      },
      {
        name: 'a \\unrestrict without a \\restrict',
        dump: 'SELECT 1;\n\\unrestrict abc\n',
        line: 2,
      },
    ])('refuses $name', ({ dump, line }) => {
      const error = thrownBy(() =>
        sanitizeDump(dump, DEFAULT_SANITIZE_OPTIONS)
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'PSQL_META_COMMAND' });
      expect(messageOf(error)).toContain(`line ${line}`);
    });

    it('keeps the backslash lines inside the function body of backslash-line-in-function-body.sql', () => {
      const dump = readAdversarial('backslash-line-in-function-body.sql');
      const fn = dump.split('\n').slice(25, 35).join('\n');

      expect(fn).toMatch(/^CREATE FUNCTION public\.psql_help\(\)[\s\S]*\$\$;$/);
      expect(sanitize(dump)).toContain(fn);
      expect(sanitize(dump)).not.toMatch(/^\\(?:un)?restrict /m);
    });
  });

  describe('R2: data', () => {
    it('refuses the COPY … FROM stdin of copy-data.sql, with its line', () => {
      const error = thrownBy(() =>
        sanitizeDump(readAdversarial('copy-data.sql'), DEFAULT_SANITIZE_OPTIONS)
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'DATA_IN_DUMP' });
      expect(messageOf(error)).toContain('line 54');
      expect(messageOf(error)).toContain('--schema-only');
    });

    it('keeps a COPY … FROM stdin that is only text in a function body', () => {
      const dump =
        "CREATE FUNCTION public.f() RETURNS text\n    LANGUAGE sql\n    AS $$ SELECT 'COPY public.t FROM stdin;' $$;\n";

      expect(sanitize(dump)).toBe(dump);
    });

    it.each(['insert-data.sql', 'column-inserts-data.sql'])(
      'refuses the INSERT statements of %s, with the line of the first one',
      (file) => {
        const error = thrownBy(() =>
          sanitizeDump(readAdversarial(file), DEFAULT_SANITIZE_OPTIONS)
        );

        expect(error).toBeInstanceOf(BaselineError);
        expect(error).toMatchObject({ code: 'DATA_IN_DUMP' });
        expect(messageOf(error)).toContain('line 54');
        expect(messageOf(error)).toContain('--schema-only');
      }
    );

    it('refuses the setval() that gives a sequence its value from the data, with its line', () => {
      const error = thrownBy(() =>
        sanitizeDump(
          "CREATE SEQUENCE public.notes_id_seq\n    START WITH 1;\n\nSELECT pg_catalog.setval('public.notes_id_seq', 2, true);\n",
          DEFAULT_SANITIZE_OPTIONS
        )
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'DATA_IN_DUMP' });
      expect(messageOf(error)).toContain('line 4');
      expect(messageOf(error)).toContain('--schema-only');
    });
  });

  describe('R3: CREATE DATABASE', () => {
    it.each([
      {
        name: 'the CREATE DATABASE of create-database.sql',
        dump: readAdversarial('create-database.sql'),
      },
      {
        name: 'a lower-case create database',
        dump: 'create database app;\n',
      },
    ])('refuses $name', ({ dump }) => {
      const error = thrownBy(() =>
        sanitizeDump(dump, DEFAULT_SANITIZE_OPTIONS)
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'CREATE_DATABASE' });
      expect(messageOf(error)).toContain('--create');
    });

    it('keeps a table named database', () => {
      const dump = 'CREATE TABLE public.database (id integer);\n';

      expect(sanitize(dump)).toBe(dump);
    });
  });

  describe('R4: DROP statements', () => {
    it.each([
      {
        name: 'the DROP TABLE of clean-dump.sql',
        dump: readAdversarial('clean-dump.sql'),
      },
      {
        name: 'DROP SCHEMA',
        dump: 'DROP SCHEMA IF EXISTS app CASCADE;\nCREATE SCHEMA app;\n',
      },
      {
        name: 'a lower-case drop index',
        dump: 'drop index public.t_id_idx;\n',
      },
      {
        name: 'DROP EXTENSION',
        dump: 'DROP EXTENSION IF EXISTS pg_trgm;\n',
      },
    ])('refuses $name', ({ dump }) => {
      const error = thrownBy(() =>
        sanitizeDump(dump, DEFAULT_SANITIZE_OPTIONS)
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'CLEAN_DUMP' });
      expect(messageOf(error)).toContain('--clean');
    });

    it('keeps ALTER TABLE … DROP … and a DROP in a comment', () => {
      const dump =
        'ALTER TABLE IF EXISTS ONLY public.notes DROP CONSTRAINT IF EXISTS notes_pkey;\nALTER TABLE public.notes ALTER COLUMN id DROP DEFAULT;\n-- DROP TABLE public.notes;\n';

      expect(sanitize(dump)).toBe(dump);
    });
  });

  describe('R5: the search_path reset', () => {
    it.each([
      "SELECT pg_catalog.set_config('search_path', '', false);",
      "select set_config('search_path', '', false);",
      "SELECT  pg_catalog.set_config( 'search_path' ,'', FALSE ) ;",
      "SELECT pg_catalog.set_config('search_path',\n    '', false);",
    ])('drops %j', (reset) => {
      const sql = sanitize(`${reset}\nCREATE TABLE public.t (id integer);\n`);

      expect(sql).not.toMatch(/search_path|set_config/i);
      expect(sql.trim()).toBe('CREATE TABLE public.t (id integer);');
    });

    it('keeps other SELECTs', () => {
      const dump =
        "SELECT pg_catalog.current_setting('search_path');\nSELECT 1;\n";

      expect(sanitize(dump)).toBe(dump);
    });
  });

  describe('R6: session settings', () => {
    it('drops the *_timeout settings', () => {
      const sql = sanitize(
        'SET statement_timeout = 0;\nSET lock_timeout = 0;\nSET idle_in_transaction_session_timeout = 0;\nSET transaction_timeout = 0;\nSET idle_session_timeout = 0;\nCREATE TABLE public.t (id integer);\n'
      );

      expect(sql).not.toMatch(/timeout|set_config/);
      expect(sql.trim()).toBe('CREATE TABLE public.t (id integer);');
    });

    it('turns a setting into SET LOCAL, after saving its value, and restores it at the end', () => {
      expect(
        sanitize(
          'SET client_min_messages = warning;\nCREATE TABLE public.t (id integer);\n'
        )
      ).toMatch(
        new RegExp(
          [
            `^${escapeRegExp(saveOf('client_min_messages'))}`,
            setLocalSource('client_min_messages', 'warning'),
            escapeRegExp('CREATE TABLE public.t (id integer);'),
            `${escapeRegExp(restoreOf('client_min_messages'))}\n$`,
          ].join(String.raw`\s*`)
        )
      );
    });

    it('saves each setting once, and restores them at the end in first-seen order', () => {
      const sql = sanitize(
        'SET client_min_messages = warning;\nSET check_function_bodies = false;\nCREATE TABLE public.a (id integer);\nSET client_min_messages = notice;\nCREATE TABLE public.b (id integer);\n'
      );

      expect(countOf(sql, saveOf('client_min_messages'))).toBe(1);
      expect(countOf(sql, saveOf('check_function_bodies'))).toBe(1);
      expect(countOf(sql, restoreOf('client_min_messages'))).toBe(1);
      expect(countOf(sql, restoreOf('check_function_bodies'))).toBe(1);
      expect(countOf(sql, 'node_pg_migrate.')).toBe(4);
      expect(sql).toMatch(
        inOrder(
          saveOf('client_min_messages'),
          new RegExp(setLocalSource('client_min_messages', 'warning')),
          saveOf('check_function_bodies'),
          new RegExp(setLocalSource('check_function_bodies', 'false')),
          'CREATE TABLE public.a (id integer);',
          new RegExp(setLocalSource('client_min_messages', 'notice')),
          'CREATE TABLE public.b (id integer);',
          restoreOf('client_min_messages'),
          restoreOf('check_function_bodies')
        )
      );
      expect(
        restoresAtTheEnd(sql, ['client_min_messages', 'check_function_bodies'])
      ).toBe(true);
    });

    it('accepts SET … TO … and values with quotes', () => {
      const sql = sanitize(
        "SET search_path TO app, public;\nSET application_name = 'a;b';\nCREATE TABLE app.t (id integer);\n"
      );

      expect(sql).toMatch(
        inOrder(
          saveOf('search_path'),
          new RegExp(setLocalSource('search_path', 'app, public')),
          saveOf('application_name'),
          new RegExp(setLocalSource('application_name', "'a;b'")),
          'CREATE TABLE app.t (id integer);'
        )
      );
      expect(restoresAtTheEnd(sql, ['search_path', 'application_name'])).toBe(
        true
      );
    });

    it('keeps SET LOCAL and SET SESSION as they are', () => {
      const dump =
        "SET LOCAL lock_timeout = '1s';\nSET SESSION statement_timeout = 0;\nCREATE TABLE public.t (id integer);\n";

      expect(sanitize(dump)).toBe(dump);
    });

    it('keeps SET clauses of other statements', () => {
      const dump =
        "ALTER TABLE public.t ALTER COLUMN a SET DEFAULT 0;\nCREATE FUNCTION public.f() RETURNS integer\n    LANGUAGE sql\n    SET search_path TO 'public'\n    AS $$ SELECT 1 $$;\n";

      expect(sanitize(dump)).toBe(dump);
    });

    it('refuses the standard_conforming_strings = off of standard-conforming-strings-off.sql, whose string literals would change meaning, and says how to dump it again', () => {
      const error = thrownBy(() =>
        sanitizeDump(
          readAdversarial('standard-conforming-strings-off.sql'),
          DEFAULT_SANITIZE_OPTIONS
        )
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'NON_STANDARD_STRINGS' });
      expect(messageOf(error)).toContain('standard_conforming_strings');
      expect(messageOf(error)).toContain(
        "PGOPTIONS='-c standard_conforming_strings=on'"
      );
    });

    it("refuses the client_encoding = 'LATIN1' of latin1-encoding.sql, which is not UTF-8 text, and says how to dump it again", () => {
      const error = thrownBy(() =>
        sanitizeDump(
          readAdversarial('latin1-encoding.sql'),
          DEFAULT_SANITIZE_OPTIONS
        )
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'NOT_UTF8' });
      expect(messageOf(error)).toContain('UTF-8');
      expect(messageOf(error)).toContain('--encoding=UTF8');
    });
  });

  describe('the role that runs the migration', () => {
    it.each([
      {
        file: 'set-session-authorization.sql',
        statement: "SET SESSION AUTHORIZATION 'app_owner';",
      },
      { file: 'set-role.sql', statement: 'SET ROLE app_owner;' },
    ])(
      'refuses the $statement of $file, and says to make the dump with --no-owner',
      ({ file, statement }) => {
        const dump = readAdversarial(file);
        const error = thrownBy(() =>
          sanitizeDump(dump, DEFAULT_SANITIZE_OPTIONS)
        );

        expect(dump.split('\n')).toContain(statement);
        expect(error).toBeInstanceOf(BaselineError);
        expect(error).toMatchObject({ code: 'SET_ROLE_IN_DUMP' });
        expect(messageOf(error)).toMatch(/role/i);
        expect(messageOf(error)).toContain('--no-owner');
      }
    );
  });

  describe('BEGIN ATOMIC bodies that use begin as a name', () => {
    const dump = readAdversarial('begin-in-atomic-body.sql');
    const settings = savedSettingsOf(dump);

    it('drops the \\restrict pair of begin-in-atomic-body.sql and turns every setting into SET LOCAL, after the functions too', () => {
      const sql = sanitize(dump);

      expect(sql).not.toMatch(/^\\(?:un)?restrict\b/m);
      expect(sql).not.toMatch(/^SET (?!LOCAL )/m);
      expect(restoresAtTheEnd(sql, settings)).toBe(true);
    });

    it('keeps every other line of begin-in-atomic-body.sql byte for byte and in order, and counts its three tables', () => {
      const { sql, stats } = sanitizeDump(dump, DEFAULT_SANITIZE_OPTIONS);

      expect(originalLinesOf(sql, settings)).toEqual(keptLinesOf(dump));
      expect(stats.tables).toBe(3);
    });

    it('refuses the table data of begin-in-atomic-body-with-data.sql, with its line', () => {
      const error = thrownBy(() =>
        sanitizeDump(
          readAdversarial('begin-in-atomic-body-with-data.sql'),
          DEFAULT_SANITIZE_OPTIONS
        )
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'DATA_IN_DUMP' });
      expect(messageOf(error)).toContain('line 116');
      expect(messageOf(error)).toContain('--schema-only');
    });
  });

  describe('R7: COMMENT ON EXTENSION', () => {
    it('drops the COMMENT ON EXTENSION of comment-on-extension.sql and keeps the extension', () => {
      const sql = sanitize(readAdversarial('comment-on-extension.sql'));

      expect(sql).not.toContain('COMMENT ON EXTENSION');
      expect(sql).toMatch(
        inOrder(
          'CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;',
          'CREATE TABLE public.words (\n    word text NOT NULL\n);',
          'CREATE INDEX words_word_trgm_idx ON public.words USING gin (word public.gin_trgm_ops);'
        )
      );
    });

    it('keeps other comments that mention extensions', () => {
      const dump =
        "COMMENT ON SCHEMA kitchen IS 'about extensions';\nCOMMENT ON TABLE public.t IS 'COMMENT ON EXTENSION pg_trgm';\n";

      expect(sanitize(dump)).toBe(dump);
    });
  });

  describe('R8: CREATE SCHEMA public', () => {
    it.each(['CREATE SCHEMA public;', 'CREATE SCHEMA "public";'])(
      'drops %s',
      (statement) => {
        const sql = sanitize(
          `${statement}\nCREATE TABLE public.t (id integer);\n`
        );

        expect(sql).not.toContain('CREATE SCHEMA');
        expect(sql.trim()).toBe('CREATE TABLE public.t (id integer);');
      }
    );

    it('drops the CREATE SCHEMA public of create-schema-public.sql and keeps its table', () => {
      const sql = sanitize(readAdversarial('create-schema-public.sql'));

      expect(sql).not.toContain('CREATE SCHEMA');
      expect(sql).toMatch(
        inOrder(
          'CREATE TABLE public.notes (\n    id integer NOT NULL,\n    body text NOT NULL\n);',
          'ALTER TABLE ONLY public.notes\n    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);'
        )
      );
    });

    it('keeps other schemas', () => {
      const dump =
        'CREATE SCHEMA app;\nCREATE SCHEMA "Public";\nCREATE SCHEMA public_archive;\n';

      expect(sanitize(dump)).toBe(dump);
    });
  });

  describe('R8b: the default comment on schema public', () => {
    it('drops the default comment of create-schema-public.sql', () => {
      expect(
        sanitize(readAdversarial('create-schema-public.sql'))
      ).not.toContain("COMMENT ON SCHEMA public IS 'standard public schema';");
    });

    it('drops the default comment', () => {
      const sql = sanitize(
        "COMMENT ON SCHEMA public IS 'standard public schema';\nCREATE TABLE public.t (id integer);\n"
      );

      expect(sql).not.toContain('COMMENT ON SCHEMA');
      expect(sql.trim()).toBe('CREATE TABLE public.t (id integer);');
    });

    it('keeps any other comment on schema public', () => {
      const dump = "COMMENT ON SCHEMA public IS 'Our main schema';\n";

      expect(sanitize(dump)).toBe(dump);
    });
  });

  describe('R9: the migrations table and its sequence', () => {
    it.each([
      {
        name: 'the migrations table of migrations-table.sql',
        dump: readAdversarial('migrations-table.sql'),
        options: DEFAULT_SANITIZE_OPTIONS,
        object: 'pgmigrations',
      },
      {
        name: 'the migrations sequence of migrations-sequence.sql',
        dump: readAdversarial('migrations-sequence.sql'),
        options: DEFAULT_SANITIZE_OPTIONS,
        object: 'pgmigrations_id_seq',
      },
      {
        name: 'app.pgmigrations of migrations-table-lookalike.sql with migrationsSchema app',
        dump: readAdversarial('migrations-table-lookalike.sql'),
        options: { migrationsSchema: 'app', migrationsTable: 'pgmigrations' },
        object: 'pgmigrations',
      },
      {
        name: 'public."PgMigrations" of migrations-table-lookalike.sql with migrationsTable PgMigrations',
        dump: readAdversarial('migrations-table-lookalike.sql'),
        options: {
          migrationsSchema: 'public',
          migrationsTable: 'PgMigrations',
        },
        object: 'PgMigrations',
      },
      {
        name: 'an unquoted name that folds to the migrations table',
        dump: 'CREATE TABLE PUBLIC.PgMigrations (\n    id integer NOT NULL\n);\n',
        options: DEFAULT_SANITIZE_OPTIONS,
        object: 'pgmigrations',
      },
      {
        name: 'a quoted name of the migrations table',
        dump: 'CREATE TABLE "public"."pgmigrations" (\n    id integer NOT NULL\n);\n',
        options: DEFAULT_SANITIZE_OPTIONS,
        object: 'pgmigrations',
      },
      {
        name: 'the configured migrations sequence',
        dump: 'CREATE SEQUENCE app.custom_seq\n    START WITH 1;\n',
        options: {
          migrationsSchema: 'app',
          migrationsTable: 'migrations',
          migrationsSequence: { schema: 'app', name: 'custom_seq' },
        },
        object: 'custom_seq',
      },
    ])('refuses $name', ({ dump, options, object }) => {
      const error = thrownBy(() => sanitizeDump(dump, options));

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'MIGRATIONS_TABLE_IN_DUMP' });
      expect(messageOf(error)).toContain(object);
      expect(messageOf(error)).toMatch(/exclude/i);
    });

    it('keeps the look-alikes of migrations-table-lookalike.sql', () => {
      const sql = sanitize(readAdversarial('migrations-table-lookalike.sql'));

      expect(sql).toMatch(
        inOrder(
          'CREATE TABLE app.pgmigrations (',
          'CREATE SEQUENCE app.pgmigrations_id_seq',
          'CREATE TABLE public."PgMigrations" (',
          'CREATE SEQUENCE public."PgMigrations_id_seq"'
        )
      );
    });

    it('keeps a sequence named like the default one when another sequence is configured', () => {
      const dump = 'CREATE SEQUENCE app.migrations_id_seq\n    START WITH 1;\n';

      expect(
        sanitize(dump, {
          migrationsSchema: 'app',
          migrationsTable: 'migrations',
          migrationsSequence: { schema: 'app', name: 'custom_seq' },
        })
      ).toBe(dump);
    });
  });

  describe('R10: marker collisions', () => {
    it('refuses the marker in the function body of marker-in-function-body.sql, with its line', () => {
      const error = thrownBy(() =>
        sanitizeDump(
          readAdversarial('marker-in-function-body.sql'),
          DEFAULT_SANITIZE_OPTIONS
        )
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'MARKER_COLLISION' });
      expect(messageOf(error)).toContain('line 30');
      expect(messageOf(error)).toContain('-- Up Migration');
    });

    it.each([
      '-- Down Migration',
      '--- up migration',
      '   --  Up   Migration',
      '-- DOWN MIGRATION: later',
    ])('refuses %j in a string, with its line in the dump', (marker) => {
      const error = thrownBy(() =>
        sanitizeDump(
          `SET statement_timeout = 0;\nSET client_min_messages = warning;\nCOMMENT ON TABLE public.t IS '\n${marker}\n';\n`,
          DEFAULT_SANITIZE_OPTIONS
        )
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'MARKER_COLLISION' });
      expect(messageOf(error)).toContain('line 4');
      expect(messageOf(error)).toContain(marker.trim());
    });

    it('refuses a marker in a comment between statements', () => {
      const error = thrownBy(() =>
        sanitizeDump(
          'CREATE TABLE public.t (id integer);\n-- Up Migration\nCREATE TABLE public.u (id integer);\n',
          DEFAULT_SANITIZE_OPTIONS
        )
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'MARKER_COLLISION' });
      expect(messageOf(error)).toContain('line 2');
    });

    it('keeps lines that only look like markers', () => {
      const dump =
        "-- Upgrade migration notes\n-- Up-Migration\nSELECT 1; -- Up Migration\nCOMMENT ON TABLE public.t IS 'Down Migration';\n";

      expect(sanitize(dump)).toBe(dump);
    });
  });

  describe('R11: everything else', () => {
    it('keeps a statement byte for byte and ends the output with a newline', () => {
      expect(sanitize('CREATE TABLE public.t (id integer);')).toBe(
        'CREATE TABLE public.t (id integer);\n'
      );
    });

    it('ends the output with exactly one newline', () => {
      expect(sanitize('CREATE TABLE public.t (id integer);\n\n\n')).toBe(
        'CREATE TABLE public.t (id integer);\n'
      );
    });

    it('keeps comments, blank lines, SET LOCAL and other SELECTs byte for byte', () => {
      const dump =
        "-- a comment\n\n/* a block comment */\nSET LOCAL lock_timeout = '1s';\nSELECT pg_catalog.current_setting('search_path');\n\nCREATE TABLE public.t (\n    id integer\n);\n";

      expect(sanitize(dump)).toBe(dump);
    });
  });

  describe('R12: stats and source', () => {
    it('counts the tables, indexes, index-backed constraints, sequences and views a dump creates', () => {
      const dump = `CREATE TABLE public.a (id integer);
CREATE UNLOGGED TABLE public.b (id integer);
CREATE TABLE public.c (id integer) PARTITION BY RANGE (id);
CREATE TABLE public.c_1 (id integer);
ALTER TABLE ONLY public.c ATTACH PARTITION public.c_1 FOR VALUES FROM (1) TO (10);
CREATE INDEX a_id_idx ON public.a USING btree (id);
CREATE UNIQUE INDEX b_id_idx ON public.b USING btree (id);
ALTER TABLE ONLY public.a
    ADD CONSTRAINT a_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.b
    ADD CONSTRAINT b_id_key UNIQUE (id);
ALTER TABLE ONLY public.c
    ADD CONSTRAINT c_no_overlap EXCLUDE USING gist (id WITH =);
ALTER TABLE ONLY public.c_1
    ADD CONSTRAINT "c_1 PRIMARY KEY" PRIMARY KEY (id), ADD CONSTRAINT c_1_id_key UNIQUE (id);
ALTER TABLE public.a
    ADD CONSTRAINT unique_positive CHECK ((id > 0));
ALTER TABLE ONLY public.b
    ADD CONSTRAINT "no PRIMARY KEY here" FOREIGN KEY (id) REFERENCES public.a(id);
CREATE SEQUENCE public.s
    START WITH 1;
ALTER TABLE public.b ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.b_id_seq
);
CREATE VIEW public.v AS
 SELECT 1 AS one;
CREATE OR REPLACE VIEW public.w AS
 SELECT 2 AS two;
CREATE MATERIALIZED VIEW public.m AS
 SELECT 3 AS three
  WITH NO DATA;
CREATE FUNCTION public.f() RETURNS void
    LANGUAGE sql
    AS $$ CREATE TABLE public.not_counted (id integer); CREATE INDEX not_counted_idx ON public.not_counted (id) $$;
COMMENT ON TABLE public.a IS 'CREATE TABLE public.x (id integer);';
-- CREATE TABLE public.commented_out (id integer);
`;

      expect(sanitizeDump(dump, DEFAULT_SANITIZE_OPTIONS).stats).toEqual({
        tables: 4,
        indexes: 2,
        indexBackedConstraints: 5,
        sequences: 2,
        views: 2,
        materializedViews: 1,
      });
    });

    it('counts what a generated pg_dump-like dump creates', () => {
      expect(
        sanitizeDump(generateDumpLike(25), DEFAULT_SANITIZE_OPTIONS).stats
      ).toEqual({
        tables: 25,
        indexes: 50,
        indexBackedConstraints: 50,
        sequences: 25,
        views: 2,
        materializedViews: 0,
      });
    });

    it('reads the versions from the header comments', () => {
      expect(
        sanitizeDump(
          '--\n-- PostgreSQL database dump\n--\n\n-- Dumped from database version 16.4 (Debian 16.4-1.pgdg120+2)\n-- Dumped by pg_dump version 17.0\n\nCREATE TABLE public.t (id integer);\n',
          DEFAULT_SANITIZE_OPTIONS
        ).source
      ).toEqual({
        serverVersion: '16.4 (Debian 16.4-1.pgdg120+2)',
        pgDumpVersion: '17.0',
      });
    });

    it('leaves the versions out when the dump has no header comments', () => {
      const { source } = sanitizeDump(
        'CREATE TABLE public.t (id integer);\n',
        DEFAULT_SANITIZE_OPTIONS
      );

      expect(source.serverVersion).toBeUndefined();
      expect(source.pgDumpVersion).toBeUndefined();
    });
  });

  describe.each(CAPTURED_DUMPS)('the captured dump $name', (dump) => {
    const settings = savedSettingsOf(dump.sql);

    it('drops the \\restrict pair', () => {
      expect(sanitize(dump.sql)).not.toMatch(/^\\(?:un)?restrict\b/m);
    });

    it('drops the search_path reset', () => {
      expect(sanitize(dump.sql)).not.toMatch(
        /set_config\('search_path', '', false\)/
      );
    });

    it('has no session-level SET and no *_timeout setting', () => {
      const sql = sanitize(dump.sql);

      expect(sql).not.toMatch(/^SET (?!LOCAL )/m);
      expect(sql).not.toMatch(/_timeout/);
    });

    it('saves and restores each setting once, with the restores at the very end', () => {
      const sql = sanitize(dump.sql);

      expect(settings.length).toBeGreaterThan(0);
      expect(
        settings.map((name) => [
          name,
          countOf(sql, saveOf(name)),
          countOf(sql, restoreOf(name)),
        ])
      ).toEqual(settings.map((name) => [name, 1, 1]));
      expect(countOf(sql, 'node_pg_migrate.')).toBe(2 * settings.length);
      expect(
        settings.filter(
          (name) =>
            sql.indexOf(saveOf(name)) >
            sql.search(new RegExp(String.raw`SET LOCAL ${name}\b`))
        )
      ).toEqual([]);
      expect(restoresAtTheEnd(sql, settings)).toBe(true);
    });

    it('drops COMMENT ON EXTENSION', () => {
      expect(sanitize(dump.sql)).not.toMatch(/^COMMENT ON EXTENSION /m);
    });

    it('keeps every other line byte for byte and in order', () => {
      expect(originalLinesOf(sanitize(dump.sql), settings)).toEqual(
        keptLinesOf(dump.sql)
      );
    });

    it('ends with exactly one newline', () => {
      const sql = sanitize(dump.sql);

      expect(sql.endsWith('\n')).toBe(true);
      expect(sql.endsWith('\n\n')).toBe(false);
    });

    it('is idempotent', () => {
      const once = sanitize(dump.sql);

      expect(sanitize(once)).toBe(once);
    });

    it('counts the objects the dump creates', () => {
      const expected = statsOf(dump.sql);

      expect(tocStatsOf(dump.sql)).toEqual(expected);
      expect(sanitizeDump(dump.sql, DEFAULT_SANITIZE_OPTIONS).stats).toEqual(
        expected
      );
    });

    it('reads the versions from the header comments', () => {
      const serverVersion = /^-- Dumped from database version (.+)$/m.exec(
        dump.sql
      )?.[1];
      const pgDumpVersion = /^-- Dumped by pg_dump version (.+)$/m.exec(
        dump.sql
      )?.[1];

      expect(serverVersion?.startsWith(`${dump.major}.`)).toBe(true);
      expect(pgDumpVersion?.startsWith(`${dump.major}.`)).toBe(true);
      expect(sanitizeDump(dump.sql, DEFAULT_SANITIZE_OPTIONS).source).toEqual({
        serverVersion,
        pgDumpVersion,
      });
    });

    it('makes an up migration without a down migration once the header is added', async () => {
      const { sql, stats, source } = sanitizeDump(
        dump.sql,
        DEFAULT_SANITIZE_OPTIONS
      );
      const content =
        renderHeader({
          migrationName: '1700000000000_baseline',
          fakeCommand: 'node-pg-migrate up 1700000000000_baseline --fake',
          source,
          materializedViews: stats.materializedViews,
          relations: 20_000,
          requiredMaxLocksPerTransaction: 256,
        }) + sql;
      const { up, down } = getActions(content);
      const pgm = { sql: vi.fn() };

      expect(down).toBe(false);
      if (typeof up !== 'function') {
        throw new TypeError('expected an up migration');
      }

      await up(pgm as unknown as MigrationBuilder);

      expect(pgm.sql).toHaveBeenCalledExactlyOnceWith(content);
    });
  });
});
