import { describe, expect, it } from 'vitest';
import { renameOperatorFamily } from '../../../src/operations/operators';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('operators', () => {
    describe('renameOperatorFamily', () => {
      const renameOperatorFamilyFn = renameOperatorFamily(options1);

      it('should return a function', () => {
        expect(renameOperatorFamilyFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renameOperatorFamilyFn(
          'integer_ops',
          'btree',
          'integer_ops_new'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER OPERATOR FAMILY "integer_ops" USING btree RENAME TO "integer_ops_new";'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = renameOperatorFamilyFn(
          { name: 'integer_ops', schema: 'myschema' },
          'btree',
          { name: 'integer_ops_new', schema: 'myschema' }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER OPERATOR FAMILY "myschema"."integer_ops" USING btree RENAME TO "integer_ops_new";'
        );
      });

      describe.each(['up', 'down'] as const)('%s identity', (direction) => {
        const operation =
          direction === 'down'
            ? renameOperatorFamilyFn.reverse
            : renameOperatorFamilyFn;

        it.each(['btree', 'hash', '"customMethod"'])(
          'preserves access method %s',
          (method) => {
            expect(
              operation({ schema: 'app', name: 'old' }, method, {
                schema: 'app',
                name: 'new',
              })
            ).toBe(
              direction === 'down'
                ? `ALTER OPERATOR FAMILY "app"."new" USING ${method} RENAME TO "old";`
                : `ALTER OPERATOR FAMILY "app"."old" USING ${method} RENAME TO "new";`
            );
          }
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameOperatorFamilyFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameOperatorFamilyFn.reverse(
            'integer_ops',
            'btree',
            'integer_ops_new'
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER OPERATOR FAMILY "integer_ops_new" USING btree RENAME TO "integer_ops";'
          );
        });
      });
    });
  });
});
