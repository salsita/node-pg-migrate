import { describe, expect, it } from 'vitest';
import { addConstraint } from '../../../src/operations/tables';
import { options1 } from '../../utils';

describe('operations', () => {
  describe('constraints', () => {
    describe('addConstraint', () => {
      const addConstraintFn = addConstraint(options1);

      it('should return a function', () => {
        expect(addConstraintFn).toBeTypeOf('function');
      });

      // TODO @Shinigami92 2024-03-13: This should throw an error
      it('should return sql statement', () => {
        const statement = addConstraintFn('distributors', 'zipchk', {});

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER TABLE "distributors"
  ADD ;`);
      });

      it('should return sql statement with constraintOptions', () => {
        const statement = addConstraintFn('distributors', 'zipchk', {
          check: ['char_length(zipcode) = 5', 'zipcode <> 0'],
          exclude: 'zipcode WITH =',
          deferrable: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER TABLE "distributors"
  ADD CONSTRAINT "zipchk" CHECK (char_length(zipcode) = 5) DEFERRABLE INITIALLY IMMEDIATE,
  ADD CONSTRAINT "zipchk" CHECK (zipcode <> 0) DEFERRABLE INITIALLY IMMEDIATE,
  ADD CONSTRAINT "zipchk" EXCLUDE zipcode WITH = DEFERRABLE INITIALLY IMMEDIATE;`);
      });

      it('should return sql statement with schema', () => {
        const statement = addConstraintFn(
          {
            name: 'distributors',
            schema: 'myschema',
          },
          'zipchk',
          'CHECK (char_length(zipcode) = 5)'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `ALTER TABLE "myschema"."distributors"
  ADD CONSTRAINT "zipchk" CHECK (char_length(zipcode) = 5);`
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(addConstraintFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = addConstraintFn.reverse(
            'distributors',
            'zipchk',
            {}
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER TABLE "distributors" DROP CONSTRAINT "zipchk";'
          );
        });

        it('should throw error', () => {
          expect(() =>
            addConstraintFn.reverse('distributors', null, {})
          ).toThrow(
            new Error(
              'Impossible to automatically infer down migration for addConstraint without naming constraint'
            )
          );
        });
      });
    });
  });
});
