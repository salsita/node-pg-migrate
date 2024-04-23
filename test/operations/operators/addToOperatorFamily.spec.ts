import { describe, expect, it } from 'vitest';
import { addToOperatorFamily } from '../../../src/operations/operators';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('operators', () => {
    describe('addToOperatorFamily', () => {
      const addToOperatorFamilyFn = addToOperatorFamily(options1);

      it('should return a function', () => {
        expect(addToOperatorFamilyFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = addToOperatorFamilyFn('integer_ops', 'btree', [
          {
            type: 'operator',
            number: 1,
            name: '<',
            params: [{ type: 'int4' }, { type: 'int2' }],
          },
          {
            type: 'operator',
            number: 2,
            name: '<=',
            params: [{ type: 'int4' }, { type: 'int2' }],
          },
          {
            type: 'operator',
            number: 3,
            name: '=',
            params: [{ type: 'int4' }, { type: 'int2' }],
          },
          {
            type: 'operator',
            number: 4,
            name: '>=',
            params: [{ type: 'int4' }, { type: 'int2' }],
          },
          {
            type: 'operator',
            number: 5,
            name: '>',
            params: [{ type: 'int4' }, { type: 'int2' }],
          },
          {
            type: 'function',
            number: 1,
            name: 'btint42cmp',
            params: [{ type: 'int4' }, { type: 'int2' }],
          },
        ]);

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `ALTER OPERATOR FAMILY "integer_ops" USING btree ADD
  OPERATOR 1 "<"(int4, int2),
  OPERATOR 2 "<="(int4, int2),
  OPERATOR 3 "="(int4, int2),
  OPERATOR 4 ">="(int4, int2),
  OPERATOR 5 ">"(int4, int2),
  FUNCTION 1 "btint42cmp"(int4, int2);`
        );
      });

      it('should return sql statement with schema', () => {
        const statement = addToOperatorFamilyFn(
          { name: 'integer_ops', schema: 'myschema' },
          'btree',
          [
            {
              type: 'operator',
              number: 1,
              name: '<',
              params: [{ type: 'int4' }, { type: 'int2' }],
            },
            {
              type: 'operator',
              number: 2,
              name: '<=',
              params: [{ type: 'int4' }, { type: 'int2' }],
            },
            {
              type: 'operator',
              number: 3,
              name: '=',
              params: [{ type: 'int4' }, { type: 'int2' }],
            },
            {
              type: 'operator',
              number: 4,
              name: '>=',
              params: [{ type: 'int4' }, { type: 'int2' }],
            },
            {
              type: 'operator',
              number: 5,
              name: '>',
              params: [{ type: 'int4' }, { type: 'int2' }],
            },
            {
              type: 'function',
              number: 1,
              name: 'btint42cmp',
              params: [{ type: 'int4' }, { type: 'int2' }],
            },
          ]
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `ALTER OPERATOR FAMILY "myschema"."integer_ops" USING btree ADD
  OPERATOR 1 "<"(int4, int2),
  OPERATOR 2 "<="(int4, int2),
  OPERATOR 3 "="(int4, int2),
  OPERATOR 4 ">="(int4, int2),
  OPERATOR 5 ">"(int4, int2),
  FUNCTION 1 "btint42cmp"(int4, int2);`
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(addToOperatorFamilyFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = addToOperatorFamilyFn.reverse(
            'integer_ops',
            'btree',
            [
              {
                type: 'operator',
                number: 1,
                name: '<',
                params: [{ type: 'int4' }, { type: 'int2' }],
              },
              {
                type: 'operator',
                number: 2,
                name: '<=',
                params: [{ type: 'int4' }, { type: 'int2' }],
              },
              {
                type: 'operator',
                number: 3,
                name: '=',
                params: [{ type: 'int4' }, { type: 'int2' }],
              },
              {
                type: 'operator',
                number: 4,
                name: '>=',
                params: [{ type: 'int4' }, { type: 'int2' }],
              },
              {
                type: 'operator',
                number: 5,
                name: '>',
                params: [{ type: 'int4' }, { type: 'int2' }],
              },
              {
                type: 'function',
                number: 1,
                name: 'btint42cmp',
                params: [{ type: 'int4' }, { type: 'int2' }],
              },
            ]
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            `ALTER OPERATOR FAMILY "integer_ops" USING btree DROP
  OPERATOR 1 "<"(int4, int2),
  OPERATOR 2 "<="(int4, int2),
  OPERATOR 3 "="(int4, int2),
  OPERATOR 4 ">="(int4, int2),
  OPERATOR 5 ">"(int4, int2),
  FUNCTION 1 "btint42cmp"(int4, int2);`
          );
        });
      });
    });
  });
});
