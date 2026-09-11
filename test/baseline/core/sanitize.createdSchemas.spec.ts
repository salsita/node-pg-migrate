import { describe, expect, it } from 'vitest';
import { sanitizeDump } from '../../../src/baseline/core/sanitize';
import type { SanitizeOptions } from '../../../src/baseline/types';
import {
  CAPTURED_DUMPS,
  DEFAULT_SANITIZE_OPTIONS,
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

const KITCHEN_SINK_18 = CAPTURED_DUMPS.find(
  (dump) => dump.name === 'pg18/kitchen-sink'
);

describe('sanitizeDump', () => {
  describe('R8c: schemas node-pg-migrate may create before the baseline', () => {
    it('creates the migrations schema only if it does not exist yet', () => {
      expect(
        sanitize('CREATE SCHEMA app;\nCREATE TABLE app.t (id integer);\n', {
          migrationsSchema: 'app',
          migrationsTable: 'pgmigrations',
        })
      ).toBe(
        'CREATE SCHEMA IF NOT EXISTS app;\nCREATE TABLE app.t (id integer);\n'
      );
    });

    it('creates the configured schemas only if they do not exist yet', () => {
      expect(
        sanitize(
          'CREATE SCHEMA app;\nCREATE SCHEMA audit;\nCREATE SCHEMA other;\n',
          { ...DEFAULT_SANITIZE_OPTIONS, createdSchemas: ['app', 'audit'] }
        )
      ).toBe(
        'CREATE SCHEMA IF NOT EXISTS app;\nCREATE SCHEMA IF NOT EXISTS audit;\nCREATE SCHEMA other;\n'
      );
    });

    it.each([
      {
        name: 'an unquoted name that folds to the schema',
        statement: 'CREATE SCHEMA App;',
        schema: 'app',
        expected: 'CREATE SCHEMA IF NOT EXISTS App;',
      },
      {
        name: 'a quoted name with capitals and a dot',
        statement: 'CREATE SCHEMA "Audit.Trail";',
        schema: 'Audit.Trail',
        expected: 'CREATE SCHEMA IF NOT EXISTS "Audit.Trail";',
      },
      {
        name: 'a quoted name with a doubled quote',
        statement: 'CREATE SCHEMA "we""ird";',
        schema: 'we"ird',
        expected: 'CREATE SCHEMA IF NOT EXISTS "we""ird";',
      },
      {
        name: 'lower-case keywords and extra whitespace',
        statement: 'create   schema\n  app ;',
        schema: 'app',
        expected: 'create   schema IF NOT EXISTS\n  app ;',
      },
      {
        name: 'a comment before the name',
        statement: 'CREATE SCHEMA /* the app */ app;',
        schema: 'app',
        expected: 'CREATE SCHEMA IF NOT EXISTS /* the app */ app;',
      },
      {
        name: 'a statement without its final semicolon',
        statement: 'CREATE SCHEMA app',
        schema: 'app',
        expected: 'CREATE SCHEMA IF NOT EXISTS app',
      },
    ])('rewrites $name', ({ statement, schema, expected }) => {
      expect(
        sanitize(`${statement}\n`, {
          ...DEFAULT_SANITIZE_OPTIONS,
          createdSchemas: [schema],
        })
      ).toBe(`${expected}\n`);
    });

    it.each([
      {
        name: 'a quoted name in another case',
        statement: 'CREATE SCHEMA "App";',
      },
      {
        name: 'a quoted name in capitals',
        statement: 'CREATE SCHEMA "APP";',
      },
      {
        name: 'a schema with an owner',
        statement: 'CREATE SCHEMA app AUTHORIZATION app_owner;',
      },
      {
        name: 'a schema created with its objects',
        statement: 'CREATE SCHEMA app CREATE TABLE t (id integer);',
      },
      {
        name: 'a schema that is already created only if it does not exist',
        statement: 'CREATE SCHEMA IF NOT EXISTS app;',
      },
      {
        name: 'another schema',
        statement: 'CREATE SCHEMA app_archive;',
      },
    ])('keeps $name as it is', ({ statement }) => {
      const dump = `${statement}\n`;

      expect(
        sanitize(dump, { ...DEFAULT_SANITIZE_OPTIONS, createdSchemas: ['app'] })
      ).toBe(dump);
    });

    it('keeps the CREATE SCHEMA of the schemas node-pg-migrate does not create', () => {
      const dump = 'CREATE SCHEMA app;\n';

      expect(sanitize(dump)).toBe(dump);
    });

    it('still drops CREATE SCHEMA public, even when public is a created schema', () => {
      expect(
        sanitize(
          'CREATE SCHEMA public;\nCREATE TABLE public.t (id integer);\n',
          {
            ...DEFAULT_SANITIZE_OPTIONS,
            createdSchemas: ['public'],
          }
        )
      ).toBe('CREATE TABLE public.t (id integer);\n');
    });

    it('still refuses the migrations table in the migrations schema it creates', () => {
      const options = {
        migrationsSchema: 'app',
        migrationsTable: 'pgmigrations',
      };
      const dump = readAdversarial('migrations-table-lookalike.sql');

      expect(thrownBy(() => sanitizeDump(dump, options))).toMatchObject({
        code: 'MIGRATIONS_TABLE_IN_DUMP',
      });
    });

    it('rewrites the created schemas of a captured dump, keeps the others, and stays idempotent', () => {
      if (KITCHEN_SINK_18 === undefined) {
        throw new Error('missing captured dump pg18/kitchen-sink');
      }

      const options: SanitizeOptions = {
        migrationsSchema: 'kitchen',
        migrationsTable: 'pgmigrations',
        createdSchemas: ['Sink Área'],
      };
      const once = sanitize(KITCHEN_SINK_18.sql, options);

      expect(once).toContain('\nCREATE SCHEMA IF NOT EXISTS "Sink Área";\n');
      expect(once).toContain('\nCREATE SCHEMA IF NOT EXISTS kitchen;\n');
      expect(once).toContain('\nCREATE SCHEMA kitchen_audit;\n');
      expect(
        once.replaceAll('CREATE SCHEMA IF NOT EXISTS ', 'CREATE SCHEMA ')
      ).toBe(sanitize(KITCHEN_SINK_18.sql));
      expect(sanitize(once, options)).toBe(once);
    });
  });
});
