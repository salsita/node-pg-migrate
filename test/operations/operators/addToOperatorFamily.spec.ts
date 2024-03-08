import { describe, expect, it } from 'vitest';
import { addToOperatorFamily } from '../../../src/operations/operators';
import { options1 } from '../../utils';

describe('operations', () => {
  describe('operators', () => {
    describe('addToOperatorFamily', () => {
      const addToOperatorFamilyFn = addToOperatorFamily(options1);

      it('should return a function', () => {
        expect(addToOperatorFamilyFn).toBeTypeOf('function');
      });

      it.todo('should return sql statement', () => {
        const statement = addToOperatorFamilyFn('integer_ops', 'btree', [
          {
            name: '<',
            number: 1,
            type: 'operator',
            params: [{ type: 'int4' }, { type: 'int2' }],
          },
          {
            name: '<=',
            number: 2,
            type: 'operator',
            params: [{ type: 'int4' }, { type: 'int2' }],
          },
          {
            name: '=',
            number: 3,
            type: 'operator',
            params: [{ type: 'int4' }, { type: 'int2' }],
          },
          {
            name: '>=',
            number: 4,
            type: 'operator',
            params: [{ type: 'int4' }, { type: 'int2' }],
          },
          {
            name: '>',
            number: 5,
            type: 'operator',
            params: [{ type: 'int4' }, { type: 'int2' }],
          },
          {
            name: 'btint42cmp',
            number: 1,
            type: 'function',
            params: [{ type: 'int4' }, { type: 'int2' }],
          },
        ]);

        expect(statement).toBeTypeOf('string');
        expect(statement).toStrictEqual(
          `ALTER OPERATOR FAMILY "integer_ops" USING btree ADD
  OPERATOR 1 "<"(int4, int2),
  OPERATOR 2 "<="(int4, int2),
  OPERATOR 3 "="(int4, int2),
  OPERATOR 4 ">="(int4, int2),
  OPERATOR 5 ">"(int4, int2),
  FUNCTION 1 "btint42cmp"(int4, int2);`
        );
      });

      it.todo('should return sql statement with schema', () => {
        const statement = addToOperatorFamilyFn(
          { name: 'integer_ops', schema: 'myschema' },
          'btree',
          [
            {
              name: '<',
              number: 1,
              type: 'operator',
              params: [{ type: 'int4' }, { type: 'int2' }],
            },
            {
              name: '<=',
              number: 2,
              type: 'operator',
              params: [{ type: 'int4' }, { type: 'int2' }],
            },
            {
              name: '=',
              number: 3,
              type: 'operator',
              params: [{ type: 'int4' }, { type: 'int2' }],
            },
            {
              name: '>=',
              number: 4,
              type: 'operator',
              params: [{ type: 'int4' }, { type: 'int2' }],
            },
            {
              name: '>',
              number: 5,
              type: 'operator',
              params: [{ type: 'int4' }, { type: 'int2' }],
            },
            {
              name: 'btint42cmp',
              number: 1,
              type: 'function',
              params: [{ type: 'int4' }, { type: 'int2' }],
            },
          ]
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toStrictEqual(
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

        it.todo('should return sql statement', () => {
          const statement = addToOperatorFamilyFn.reverse(
            'integer_ops',
            'btree',
            [
              {
                name: '<',
                number: 1,
                type: 'operator',
                params: [{ type: 'int4' }, { type: 'int2' }],
              },
              {
                name: '<=',
                number: 2,
                type: 'operator',
                params: [{ type: 'int4' }, { type: 'int2' }],
              },
              {
                name: '=',
                number: 3,
                type: 'operator',
                params: [{ type: 'int4' }, { type: 'int2' }],
              },
              {
                name: '>=',
                number: 4,
                type: 'operator',
                params: [{ type: 'int4' }, { type: 'int2' }],
              },
              {
                name: '>',
                number: 5,
                type: 'operator',
                params: [{ type: 'int4' }, { type: 'int2' }],
              },
              {
                name: 'btint42cmp',
                number: 1,
                type: 'function',
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
