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

      it.each([
        [
          'ifExists',
          { ifExists: true },
          'ALTER TABLE "distributors" DROP CONSTRAINT IF EXISTS "zipchk";',
        ],
        [
          'ifTableExists',
          { ifTableExists: true },
          'ALTER TABLE IF EXISTS "distributors" DROP CONSTRAINT "zipchk";',
        ],
        [
          'ifTableExists and ifExists',
          { ifTableExists: true, ifExists: true },
          'ALTER TABLE IF EXISTS "distributors" DROP CONSTRAINT IF EXISTS "zipchk";',
        ],
        [
          'ifTableExists, ifExists and cascade',
          { ifTableExists: true, ifExists: true, cascade: true },
          'ALTER TABLE IF EXISTS "distributors" DROP CONSTRAINT IF EXISTS "zipchk" CASCADE;',
        ],
      ] as const)(
        'should return sql statement with %s',
        (_, options, expected) => {
          const statement = dropConstraintFn('distributors', 'zipchk', options);

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(expected);
        }
      );
    });
  });
});
