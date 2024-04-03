import { describe, expect, it } from 'vitest';
import { renameTable } from '../../../src/operations/tables';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('tables', () => {
    describe('renameTable', () => {
      const renameTableFn = renameTable(options1);

      it('should return a function', () => {
        expect(renameTableFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renameTableFn('distributors', 'suppliers');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TABLE "distributors" RENAME TO "suppliers";'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = renameTableFn(
          { name: 'distributors', schema: 'myschema' },
          { name: 'suppliers', schema: 'myschema' }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TABLE "myschema"."distributors" RENAME TO "myschema"."suppliers";'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameTableFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameTableFn.reverse('distributors', 'suppliers');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER TABLE "suppliers" RENAME TO "distributors";'
          );
        });
      });
    });
  });
});
