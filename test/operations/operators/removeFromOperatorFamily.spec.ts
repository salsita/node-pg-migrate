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

      it.todo('should return sql statement', () => {
        // TODO @Shinigami92 2024-03-08: looks like type is flipped
        const statement = removeFromOperatorFamilyFn('integer_ops', 'btree', [
          {
            name: '',
            type: 'operator',
            number: 1,
            params: [{ type: 'int4' }, { type: 'int2' }],
          },
          {
            name: '',
            type: 'operator',
            number: 2,
            params: [{ type: 'int4' }, { type: 'int2' }],
          },
          {
            name: '',
            type: 'function',
            number: 1,
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

      it.todo('should return sql statement with schema', () => {
        // TODO @Shinigami92 2024-03-08: looks like type is flipped
        const statement = removeFromOperatorFamilyFn(
          { name: 'integer_ops', schema: 'myschema' },
          'btree',
          [
            {
              name: '',
              type: 'operator',
              number: 1,
              params: [{ type: 'int4' }, { type: 'int2' }],
            },
            {
              name: '',
              type: 'operator',
              number: 2,
              params: [{ type: 'int4' }, { type: 'int2' }],
            },
            {
              name: '',
              type: 'function',
              number: 1,
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
