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
          'select $1 + $2;'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `CREATE FUNCTION "add"(integer, integer)
  RETURNS integer
  AS $pga$select $1 + $2;$pga$
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
          'select $1 + $2;'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `CREATE OR REPLACE FUNCTION "add"(integer, integer)
  RETURNS integer
  AS $pga$select $1 + $2;$pga$
  VOLATILE
  LANGUAGE SQL
  WINDOW
  RETURNS NULL ON NULL INPUT
  PARALLEL UNSAFE;`
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
            'select $1 + $2;'
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
            'select $1 + $2;'
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('DROP FUNCTION "add"(integer, integer);');
        });
      });
    });
  });
});
