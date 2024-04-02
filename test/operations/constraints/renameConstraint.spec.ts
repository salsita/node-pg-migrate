import { describe, expect, it } from 'vitest';
import { renameConstraint } from '../../../src/operations/tables';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('constraints', () => {
    describe('renameConstraint', () => {
      const renameConstraintFn = renameConstraint(options1);

      it('should return a function', () => {
        expect(renameConstraintFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renameConstraintFn(
          'distributors',
          'zipchk',
          'zip_check'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TABLE "distributors" RENAME CONSTRAINT "zipchk" TO "zip_check";'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = renameConstraintFn(
          { name: 'distributors', schema: 'myschema' },
          'zipchk',
          'zip_check'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TABLE "myschema"."distributors" RENAME CONSTRAINT "zipchk" TO "zip_check";'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameConstraintFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameConstraintFn.reverse(
            'distributors',
            'zipchk',
            'zip_check'
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER TABLE "distributors" RENAME CONSTRAINT "zip_check" TO "zipchk";'
          );
        });
      });
    });
  });
});
