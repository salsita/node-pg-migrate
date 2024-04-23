import { describe, expect, it } from 'vitest';
import { dropConstraint } from '../../../src/operations/tables';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('constraints', () => {
    describe('dropConstraint', () => {
      const dropConstraintFn = dropConstraint(options1);

      it('should return a function', () => {
        expect(dropConstraintFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropConstraintFn('distributors', 'zipchk');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TABLE "distributors" DROP CONSTRAINT "zipchk";'
        );
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropConstraintFn('distributors', 'zipchk', {
          ifExists: true,
          cascade: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TABLE "distributors" DROP CONSTRAINT IF EXISTS "zipchk" CASCADE;'
        );
      });
    });
  });
});
