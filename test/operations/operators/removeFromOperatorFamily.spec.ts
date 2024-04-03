import { describe, expect, it } from 'vitest';
import { removeFromOperatorFamily } from '../../../src/operations/operators';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('operators', () => {
    describe('removeFromOperatorFamily', () => {
      const removeFromOperatorFamilyFn = removeFromOperatorFamily(options1);

      it('should return a function', () => {
        expect(removeFromOperatorFamilyFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = removeFromOperatorFamilyFn('integer_ops', 'btree', [
          {
            type: 'operator',
            number: 1,
            name: '',
            params: [{ type: 'int4' }, { type: 'int2' }],
          },
          {
            type: 'operator',
            number: 2,
            name: '',
            params: [{ type: 'int4' }, { type: 'int2' }],
          },
          {
            type: 'function',
            number: 1,
            name: '',
            params: [{ type: 'int4' }, { type: 'int2' }],
          },
        ]);

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `ALTER OPERATOR FAMILY "integer_ops" USING btree DROP
  OPERATOR 1 ""(int4, int2),
  OPERATOR 2 ""(int4, int2),
  FUNCTION 1 ""(int4, int2);`
        );
      });

      it('should return sql statement with schema', () => {
        const statement = removeFromOperatorFamilyFn(
          { name: 'integer_ops', schema: 'myschema' },
          'btree',
          [
            {
              type: 'operator',
              number: 1,
              name: '',
              params: [{ type: 'int4' }, { type: 'int2' }],
            },
            {
              type: 'operator',
              number: 2,
              name: '',
              params: [{ type: 'int4' }, { type: 'int2' }],
            },
            {
              type: 'function',
              number: 1,
              name: '',
              params: [{ type: 'int4' }, { type: 'int2' }],
            },
          ]
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `ALTER OPERATOR FAMILY "myschema"."integer_ops" USING btree DROP
  OPERATOR 1 ""(int4, int2),
  OPERATOR 2 ""(int4, int2),
  FUNCTION 1 ""(int4, int2);`
        );
      });
    });
  });
});
