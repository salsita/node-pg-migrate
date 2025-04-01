import { describe, expect, it } from 'vitest';
import { createFunction } from '../../../src/operations/functions';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('functions', () => {
    describe('createFunction', () => {
      const createFunctionFn = createFunction(options1);

      it('should return a function', () => {
        expect(createFunctionFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = createFunctionFn(
          'add',
          ['integer', 'integer'],
          {
            returns: 'integer',
            language: 'SQL',
          },
          'SELECT $1 + $2;'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `CREATE FUNCTION "add"(integer, integer)
  RETURNS integer
  AS $pga$SELECT $1 + $2;$pga$
  VOLATILE
  LANGUAGE SQL;`
        );
      });

      it('should return sql statement with functionOptions', () => {
        const statement = createFunctionFn(
          'add',
          ['integer', 'integer'],
          {
            returns: 'integer',
            language: 'SQL',
            window: true,
            onNull: true,
            parallel: 'UNSAFE',
            replace: true,
          },
          'SELECT $1 + $2;'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `CREATE OR REPLACE FUNCTION "add"(integer, integer)
  RETURNS integer
  AS $pga$SELECT $1 + $2;$pga$
  VOLATILE
  LANGUAGE SQL
  WINDOW
  RETURNS NULL ON NULL INPUT
  PARALLEL UNSAFE;`
        );
      });

      it('should return sql statement with security', () => {
        const statement = createFunctionFn(
          'check_password',
          [
            { name: 'uname', type: 'text' },
            { name: 'pass', type: 'text' },
          ],
          {
            returns: 'boolean',
            language: 'plpgsql',
            security: 'DEFINER',
          },
          `
DECLARE passed BOOLEAN;
BEGIN
  SELECT (pwd = $2) INTO passed
  FROM pwds
  WHERE username = $1;
  RETURN passed;
END;
`
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `CREATE FUNCTION "check_password"("uname" text, "pass" text)
  RETURNS boolean
  AS $pga$
DECLARE passed BOOLEAN;
BEGIN
  SELECT (pwd = $2) INTO passed
  FROM pwds
  WHERE username = $1;
  RETURN passed;
END;
$pga$
  VOLATILE
  LANGUAGE plpgsql
  SECURITY DEFINER;`
        );
      });

      it('should return sql statement with set', () => {
        const statement = createFunctionFn(
          'example_function',
          [],
          {
            language: 'plpgsql',
            set: [
              {
                configurationParameter: 'search_path',
                value: "''",
              },
            ],
          },
          `
-- SQL here
`
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `CREATE FUNCTION "example_function"()
  RETURNS void
  AS $pga$
-- SQL here
$pga$
  VOLATILE
  LANGUAGE plpgsql
  SET "search_path" TO '';`
        );
      });

      it('should throw if no language provided', () => {
        expect(() =>
          createFunctionFn(
            'add',
            ['integer', 'integer'],
            // @ts-expect-error: testing invalid input
            {
              returns: 'integer',
            },
            'SELECT $1 + $2;'
          )
        ).toThrow(new Error('Language for function add have to be specified'));
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(createFunctionFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = createFunctionFn.reverse(
            'add',
            ['integer', 'integer'],
            {
              returns: 'integer',
              language: 'SQL',
            },
            'SELECT $1 + $2;'
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('DROP FUNCTION "add"(integer, integer);');
        });
      });
    });
  });
});
