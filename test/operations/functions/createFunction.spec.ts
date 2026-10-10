import { describe, expect, it } from 'vitest';
import { createFunction } from '../../../src/operations/functions';
import { PgLiteral } from '../../../src/utils';
import { options1, options1Pretty } from '../../presetMigrationOptions';

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
          `CREATE FUNCTION "add"(integer, integer) RETURNS integer AS $pga$SELECT $1 + $2;$pga$ VOLATILE LANGUAGE SQL;`
        );
      });

      it('should format the statement across multiple lines when pretty is enabled', () => {
        const statement = createFunction(options1Pretty)(
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
          `CREATE OR REPLACE FUNCTION "add"(integer, integer) RETURNS integer AS $pga$SELECT $1 + $2;$pga$ VOLATILE LANGUAGE SQL WINDOW RETURNS NULL ON NULL INPUT PARALLEL UNSAFE;`
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
          `CREATE FUNCTION "check_password"("uname" text, "pass" text) RETURNS boolean AS $pga$
DECLARE passed BOOLEAN;
BEGIN
  SELECT (pwd = $2) INTO passed
  FROM pwds
  WHERE username = $1;
  RETURN passed;
END;
$pga$ VOLATILE LANGUAGE plpgsql SECURITY DEFINER;`
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
          `CREATE FUNCTION "example_function"() RETURNS void AS $pga$
-- SQL here
$pga$ VOLATILE LANGUAGE plpgsql SET "search_path" TO '';`
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
        ).toThrow(
          new Error('Language for function "add" have to be specified')
        );
      });

      it('renders planner options with a qualified support function', () => {
        expect(
          createFunctionFn(
            { schema: 'app', name: 'series' },
            ['integer', 'integer'],
            {
              language: 'internal',
              returns: 'SETOF integer',
              cost: 2.5,
              rows: 4.5,
              support: {
                schema: 'pg_catalog',
                name: 'generate_series_int4_support',
              },
            },
            'generate_series_int4'
          )
        ).toBe(
          'CREATE FUNCTION "app"."series"(integer, integer) RETURNS SETOF integer AS $pga$generate_series_int4$pga$ VOLATILE LANGUAGE internal COST 2.5 ROWS 4.5 SUPPORT "pg_catalog"."generate_series_int4_support";'
        );
      });

      it('renders planner options separately when pretty is enabled', () => {
        expect(
          createFunction(options1Pretty)(
            'series',
            ['integer', 'integer'],
            {
              language: 'internal',
              returns: 'SETOF integer',
              cost: 1,
              rows: 3,
              support: new PgLiteral('pg_catalog.generate_series_int4_support'),
              set: [
                {
                  configurationParameter: 'search_path',
                  value: 'FROM CURRENT',
                },
              ],
            },
            'generate_series_int4'
          )
        ).toBe(`CREATE FUNCTION "series"(integer, integer)
  RETURNS SETOF integer
  AS $pga$generate_series_int4$pga$
  VOLATILE
  LANGUAGE internal
  COST 1
  ROWS 3
  SUPPORT pg_catalog.generate_series_int4_support
  SET "search_path" FROM CURRENT;`);
      });

      it.each(['cost', 'rows'] as const)(
        'rejects invalid %s estimates',
        (option) => {
          for (const value of [
            0,
            -0,
            -1,
            Number.NaN,
            Number.POSITIVE_INFINITY,
            Number.NEGATIVE_INFINITY,
          ]) {
            expect(() =>
              createFunctionFn(
                'series',
                [],
                { language: 'sql', [option]: value },
                'SELECT 1'
              )
            ).toThrow(`Function ${option} must be a positive finite number`);
          }
        }
      );

      it.each([
        [true, 'RETURNS NULL ON NULL INPUT'],
        ['RETURNS NULL', 'RETURNS NULL ON NULL INPUT'],
        ['CALLED', 'CALLED ON NULL INPUT'],
        [false, ''],
        [undefined, ''],
      ] as const)('renders explicit null handling %s', (onNull, clause) => {
        expect(
          createFunctionFn(
            'example',
            ['integer'],
            { language: 'sql', replace: true, onNull },
            'SELECT $1'
          )
        ).toBe(
          `CREATE OR REPLACE FUNCTION "example"(integer) RETURNS void AS $pga$SELECT $1$pga$ VOLATILE LANGUAGE sql${clause ? ` ${clause}` : ''};`
        );
      });

      it('quotes the support function name', () => {
        expect(
          createFunctionFn(
            'example',
            [],
            {
              language: 'sql',
              support: { schema: 'odd"schema', name: 'odd"support' },
            },
            'SELECT 1'
          )
        ).toContain('SUPPORT "odd""schema"."odd""support";');
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
