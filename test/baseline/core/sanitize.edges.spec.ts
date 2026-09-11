import { describe, expect, it } from 'vitest';
import { sanitizeDump } from '../../../src/baseline/core/sanitize';
import { BaselineError } from '../../../src/baseline/errors';
import { DEFAULT_SANITIZE_OPTIONS, messageOf, thrownBy } from '../helpers';

/**
 * The cleaned-up SQL of a dump with the default options.
 */
function sanitize(dump: string): string {
  return sanitizeDump(dump, DEFAULT_SANITIZE_OPTIONS).sql;
}

/**
 * The error sanitizing a dump with the default options throws.
 */
function refusalOf(dump: string): unknown {
  return thrownBy(() => sanitizeDump(dump, DEFAULT_SANITIZE_OPTIONS));
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

describe('sanitizeDump', () => {
  describe('the lines of dropped statements', () => {
    it.each([
      {
        name: 'a statement alone on its line, with its line break',
        dump: 'SET lock_timeout = 0;\nCREATE TABLE public.t (id integer);\n',
        expected: 'CREATE TABLE public.t (id integer);\n',
      },
      {
        name: 'spaces and a \\r\\n after the statement',
        dump: 'SET lock_timeout = 0;  \r\nCREATE TABLE public.t (id integer);\r\n',
        expected: 'CREATE TABLE public.t (id integer);\r\n',
      },
      {
        name: 'a statement that shares its line, without the rest of the line',
        dump: 'SELECT 1; SET lock_timeout = 0;\nSELECT 2;\n',
        expected: 'SELECT 1; \nSELECT 2;\n',
      },
      {
        name: 'a statement followed by a comment on its line, without the comment',
        dump: 'SET lock_timeout = 0; -- no timeout\nSELECT 1;\n',
        expected: ' -- no timeout\nSELECT 1;\n',
      },
      {
        name: 'the last statement of a dump without a final line break',
        dump: 'SELECT 1;\nSET lock_timeout = 0;',
        expected: 'SELECT 1;\n',
      },
    ])('drops $name', ({ dump, expected }) => {
      expect(sanitize(dump)).toBe(expected);
    });

    it('gives a dump that has nothing left a single line break', () => {
      expect(sanitizeDump('', DEFAULT_SANITIZE_OPTIONS)).toEqual({
        sql: '\n',
        stats: {
          tables: 0,
          indexes: 0,
          indexBackedConstraints: 0,
          sequences: 0,
          views: 0,
          materializedViews: 0,
        },
        source: {},
      });
      expect(sanitize('SET statement_timeout = 0;\n\n')).toBe('\n');
    });

    it('keeps the spaces at the end of the last line', () => {
      expect(sanitize('SELECT 1; -- done  \n\n')).toBe('SELECT 1; -- done  \n');
    });
  });

  describe('R1: psql meta-commands', () => {
    it.each([
      {
        name: 'a \\restrict without a key',
        dump: '\\restrict\nSELECT 1;\n',
        line: 1,
      },
      {
        name: 'a \\unrestrict after the pair',
        dump: '\\restrict k\nSELECT 1;\n\\unrestrict k\n\\unrestrict k\n',
        line: 4,
      },
      {
        name: 'a meta-command after a statement on the same line',
        dump: 'SELECT 1; \\connect app\nSELECT 2;\n',
        line: 1,
      },
      {
        name: 'a meta-command after spaces',
        dump: 'SELECT 1;\n   \\i more.sql\n',
        line: 2,
      },
    ])('refuses $name', ({ dump, line }) => {
      const error = refusalOf(dump);

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'PSQL_META_COMMAND' });
      expect(messageOf(error)).toContain(`line ${String(line)}:`);
    });

    it('drops a \\restrict pair whose lines end with \\r\\n', () => {
      expect(
        sanitize('\\restrict k3y\r\nSELECT 1;\r\n\\unrestrict k3y\r\n')
      ).toBe('SELECT 1;\r\n');
    });

    it('only quotes the start of a long meta-command', () => {
      const message = messageOf(refusalOf(`\\echo ${'x'.repeat(1000)}\n`));

      expect(message).toContain('\\echo xxx');
      expect(message).toContain('…');
      expect(message.length).toBeLessThan(500);
    });

    it('does not mention --create for meta-commands that do not connect', () => {
      expect(messageOf(refusalOf('\\set ON_ERROR_STOP on\n'))).not.toContain(
        '--create'
      );
      expect(messageOf(refusalOf('\\c app\n'))).toContain('--create');
    });
  });

  describe('R2: data', () => {
    it.each([
      'copy public.t from STDIN;\n',
      'COPY public.t (a, b) FROM stdin WITH (FORMAT csv);\n',
      'COPY public.t FROM /* the data follows */ stdin;\n1\n\\.\n',
    ])('refuses %j', (dump) => {
      expect(refusalOf(dump)).toMatchObject({ code: 'DATA_IN_DUMP' });
    });

    it.each([
      'COPY public.t TO stdout;\n',
      "COPY public.t FROM '/tmp/t.csv';\n",
      'COPY (SELECT * FROM stdin) TO stdout;\n',
    ])('keeps %j, which reads no data from the dump', (dump) => {
      expect(sanitize(dump)).toBe(dump);
    });
  });

  describe('R4: DROP statements', () => {
    it('quotes the first line of the DROP statement', () => {
      const message = messageOf(
        refusalOf('SELECT 1;\n\nDROP TABLE public.t\n    CASCADE;\n')
      );

      expect(message).toContain('line 3:');
      expect(message).toContain('`DROP TABLE public.t`');
    });
  });

  describe('R5: the search_path reset', () => {
    it.each([
      "SELECT pg_catalog.set_config('search_path', 'public', false);",
      "SELECT pg_catalog.set_config('search_path', '', true);",
      "SELECT pg_catalog.set_config('search_path', '', false), 1;",
      "SELECT pg_catalog.set_config('search_path', '', false) FROM t;",
      "SELECT set_config('search_path', ''",
      'SELECT pg_catalog FROM public.t;',
      "SELECT pg_catalog.current_setting('search_path');",
      'SELECT 1;',
    ])('keeps %j', (statement) => {
      const dump = `${statement}\n`;

      expect(sanitize(dump)).toBe(dump);
    });

    it.each([
      "SELECT PG_CATALOG.SET_CONFIG('SEARCH_PATH', '', FALSE);",
      "SELECT pg_catalog.set_config('search_path', '', false)",
      "SELECT /* reset */ pg_catalog.set_config('search_path', '', false);",
    ])('drops %j', (statement) => {
      expect(sanitize(`SELECT 1;\n${statement}\n`)).toBe('SELECT 1;\n');
    });
  });

  describe('R6: session settings', () => {
    it.each([
      "SET TIME ZONE 'UTC';",
      "SET SCHEMA 'app';",
      'SET app.tenant = 1;',
      "SET NAMES 'UTF8';",
      'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;',
      'SET CONSTRAINTS ALL DEFERRED;',
      "SET SESSION AUTHORIZATION 'app';",
      'SET "search_path" = public;',
      'SET;',
    ])('keeps %j, which is not a plain setting', (statement) => {
      const dump = `${statement}\n`;

      expect(sanitize(dump)).toBe(dump);
    });

    it('saves and restores a setting under its lower-case name, and keeps the rest of the statement', () => {
      expect(sanitize('set Client_Min_Messages TO warning;\n')).toBe(
        `${saveOf('client_min_messages')}\nSET LOCAL Client_Min_Messages TO warning;\n\n${restoreOf('client_min_messages')}\n`
      );
    });

    it('drops the timeouts in any case', () => {
      expect(sanitize('SET Statement_Timeout TO 0;\nSELECT 1;\n')).toBe(
        'SELECT 1;\n'
      );
    });

    it('keeps comments inside the setting', () => {
      expect(sanitize('SET /* quiet */ client_min_messages = warning;')).toBe(
        `${saveOf('client_min_messages')}\nSET LOCAL /* quiet */ client_min_messages = warning;\n\n${restoreOf('client_min_messages')}\n`
      );
    });
  });

  describe('R7, R8 and R8b: public and extensions', () => {
    it.each([
      "comment on extension pg_trgm is 'trigrams';",
      'CREATE SCHEMA IF NOT EXISTS public;',
      'CREATE SCHEMA PUBLIC;',
      'COMMENT ON SCHEMA "public" IS \'standard public schema\';',
      "comment on schema public is 'standard public schema'",
    ])('drops %j', (statement) => {
      expect(sanitize(`SELECT 1;\n${statement}\n`)).toBe('SELECT 1;\n');
    });

    it.each([
      'CREATE SCHEMA public AUTHORIZATION app;',
      "COMMENT ON SCHEMA public IS 'Standard public schema';",
      "COMMENT ON SCHEMA public IS E'standard public schema';",
      "COMMENT ON SCHEMA app IS 'standard public schema';",
      'COMMENT ON SCHEMA public IS NULL;',
      "COMMENT ON COLUMN public.t.public IS 'standard public schema';",
    ])('keeps %j', (statement) => {
      const dump = `${statement}\n`;

      expect(sanitize(dump)).toBe(dump);
    });
  });

  describe('R9: the migrations table and its sequence', () => {
    it.each([
      'CREATE UNLOGGED TABLE public.pgmigrations (id integer);',
      'CREATE TABLE IF NOT EXISTS public.pgmigrations (id integer);',
      'CREATE SEQUENCE IF NOT EXISTS public.pgmigrations_id_seq;',
      'create unlogged sequence "public"."pgmigrations_id_seq";',
    ])('refuses %j', (statement) => {
      const error = refusalOf(`SELECT 1;\n${statement}\n`);

      expect(error).toMatchObject({ code: 'MIGRATIONS_TABLE_IN_DUMP' });
      expect(messageOf(error)).toContain('line 2:');
      expect(messageOf(error)).toContain(
        '--exclude-table=\'"public"."pgmigrations'
      );
    });

    it.each([
      'CREATE TABLE pgmigrations (id integer);',
      'CREATE TABLE public.pgmigrations_archive (id integer);',
      'CREATE TABLE',
      'CREATE TABLE (id integer);',
      'CREATE VIEW public.pgmigrations AS SELECT 1;',
      'CREATE INDEX pgmigrations ON public.t (id);',
    ])('keeps %j, which does not create the migrations table', (statement) => {
      const dump = `${statement}\n`;

      expect(sanitize(dump)).toBe(dump);
    });

    it('takes the schema of the migrations sequence from the migrations schema when it has none', () => {
      expect(
        thrownBy(() =>
          sanitizeDump('CREATE SEQUENCE app.history_seq;\n', {
            migrationsSchema: 'app',
            migrationsTable: 'history',
            migrationsSequence: { name: 'history_seq' },
          })
        )
      ).toMatchObject({ code: 'MIGRATIONS_TABLE_IN_DUMP' });
    });
  });

  describe('R10: marker collisions', () => {
    it('refuses a marker that only starts its line once a statement before it is dropped', () => {
      const error = refusalOf(
        'SELECT 1;\nSET lock_timeout = 0;-- up migration\n'
      );

      expect(error).toMatchObject({ code: 'MARKER_COLLISION' });
      expect(messageOf(error)).toContain('line 2:');
      expect(messageOf(error)).toContain('`-- up migration`');
    });

    it('refuses a marker that node-pg-migrate finds across blank lines, with the line of its --', () => {
      const error = refusalOf(
        "COMMENT ON TABLE public.t IS '\n--\n\n  down  migration';\n"
      );

      expect(error).toMatchObject({ code: 'MARKER_COLLISION' });
      expect(messageOf(error)).toContain('line 2:');
    });

    it('gives the line in the dump of a marker after lines the cleanup added and dropped', () => {
      const dump = [
        '\\restrict k',
        'SET statement_timeout = 0;',
        'SET client_min_messages = warning;',
        'SET check_function_bodies = false;',
        'CREATE SCHEMA app;',
        "COMMENT ON TABLE public.t IS 'x",
        '-- Down Migration',
        "';",
        '',
      ].join('\n');
      const error = thrownBy(() =>
        sanitizeDump(dump, {
          ...DEFAULT_SANITIZE_OPTIONS,
          createdSchemas: ['app'],
        })
      );

      expect(error).toMatchObject({ code: 'MARKER_COLLISION' });
      expect(messageOf(error)).toContain('line 7:');
    });
  });

  describe('R12: stats and source', () => {
    it.each([
      {
        name: 'unlogged sequences',
        dump: 'CREATE UNLOGGED SEQUENCE public.s;\n',
        stats: { sequences: 1 },
      },
      {
        name: 'identity columns made by default',
        dump: 'ALTER TABLE public.t ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY;\n',
        stats: { sequences: 1 },
      },
      {
        name: 'nothing for an identity clause that is cut short',
        dump: 'ALTER TABLE public.t ALTER COLUMN id ADD GENERATED BY DEFAULT;\nALTER TABLE public.t ALTER COLUMN id ADD GENERATED ALWAYS;\n',
        stats: {},
      },
      {
        name: 'nothing for constraints that are cut short or have no index',
        dump: 'ALTER TABLE public.t ADD CONSTRAINT;\nALTER TABLE public.t ADD CONSTRAINT c;\nALTER TABLE public.t ADD CONSTRAINT c CHECK (true);\nALTER TABLE public.t ADD CONSTRAINT 1 UNIQUE (id);\n',
        stats: {},
      },
      {
        name: 'nothing for other ALTER statements',
        dump: 'ALTER INDEX public.i ATTACH PARTITION public.j;\nALTER DOMAIN public.d ADD CONSTRAINT c CHECK (VALUE > 0);\nALTER TABLE public.t ADD COLUMN c integer;\n',
        stats: {},
      },
      {
        name: 'nothing for other CREATE statements',
        dump: 'CREATE FUNCTION public.f() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;\nCREATE TYPE public.e AS ENUM ();\n',
        stats: {},
      },
    ])('counts $name', ({ dump, stats }) => {
      expect(sanitizeDump(dump, DEFAULT_SANITIZE_OPTIONS).stats).toEqual({
        tables: 0,
        indexes: 0,
        indexBackedConstraints: 0,
        sequences: 0,
        views: 0,
        materializedViews: 0,
        ...stats,
      });
    });

    it.each([
      {
        name: 'comments that do not start their line',
        dump: 'SELECT 1; -- Dumped from database version 9.9\n-- Dumped from database version 16.4\n',
        source: { serverVersion: '16.4' },
      },
      {
        name: 'comments without a version',
        dump: '-- Dumped by pg_dump version \n-- Dumped by pg_dump version 17.2\n',
        source: { pgDumpVersion: '17.2' },
      },
      {
        name: 'a version on a line that ends with \\r\\n',
        dump: '-- Dumped from database version 18.6\r\nSELECT 1;\r\n',
        source: { serverVersion: '18.6' },
      },
      {
        name: 'the first of several comments',
        dump: '-- Dumped by pg_dump version 18.6\nSELECT 1;\n-- Dumped by pg_dump version 1.0\n',
        source: { pgDumpVersion: '18.6' },
      },
      {
        name: 'a comment inside a statement',
        dump: "COMMENT ON TABLE public.t IS '\n-- Dumped from database version 1.0\n';\n",
        source: {},
      },
    ])('reads the versions of $name', ({ dump, source }) => {
      expect(sanitizeDump(dump, DEFAULT_SANITIZE_OPTIONS).source).toEqual(
        source
      );
    });
  });
});
