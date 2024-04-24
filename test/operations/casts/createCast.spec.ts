import { describe, expect, it } from 'vitest';
import { PgType } from '../../../src';
import { createCast } from '../../../src/operations/casts';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('casts', () => {
    describe('createCast', () => {
      const createCastFn = createCast(options1);

      it('should return a function', () => {
        expect(createCastFn).toBeTypeOf('function');
      });

      it('should return sql statement with string', () => {
        const statement = createCastFn('bigint', 'int4', {});

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE CAST (bigint AS int4) WITHOUT FUNCTION;'
        );
      });

      it('should return sql statement with PgType', () => {
        const statement = createCastFn(PgType.BIGINT, PgType.INT4, {});

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE CAST (bigint AS int4) WITHOUT FUNCTION;'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = createCastFn('bigint', 'int4', {
          functionName: { name: 'add', schema: 'myschema' },
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE CAST (bigint AS int4) WITH FUNCTION "myschema"."add"(bigint);'
        );
      });

      it('should return sql statement with castOptions', () => {
        const statement = createCastFn('bigint', 'int4', {
          functionName: 'add',
          argumentTypes: ['integer', 'integer'],
          inout: true,
          as: 'assignment',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE CAST (bigint AS int4) WITH FUNCTION "add"(integer, integer) AS assignment;'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(createCastFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = createCastFn.reverse('bigint', 'int4', {});

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('DROP CAST (bigint AS int4);');
        });
      });
    });
  });
});
