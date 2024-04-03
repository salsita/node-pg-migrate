import { describe, expect, it } from 'vitest';
import { renameColumn } from '../../../src/operations/tables';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('columns', () => {
    describe('renameColumn', () => {
      const renameColumnFn = renameColumn(options1);

      it('should return a function', () => {
        expect(renameColumnFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renameColumnFn('distributors', 'address', 'city');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TABLE "distributors" RENAME "address" TO "city";'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = renameColumnFn(
          { name: 'distributors', schema: 'myschema' },
          'address',
          'city'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TABLE "myschema"."distributors" RENAME "address" TO "city";'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameColumnFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameColumnFn.reverse(
            'distributors',
            'address',
            'city'
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER TABLE "distributors" RENAME "city" TO "address";'
          );
        });
      });
    });
  });
});
