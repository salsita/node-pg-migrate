import { describe, expect, it } from 'vitest';
import { addConstraint } from '../../../src/operations/tables';
import { options1, options2 } from '../../presetMigrationOptions';

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

      it.each([
        // should works with strings
        [
          'should works with strings 1',
          options1,
          ['myTableName', 'myConstraintName', 'CHECK name IS NOT NULL'],
          `ALTER TABLE "myTableName"
  ADD CONSTRAINT "myConstraintName" CHECK name IS NOT NULL;`,
        ],
        [
          'should works with strings 2',
          options2,
          ['myTableName', 'myConstraintName', 'CHECK name IS NOT NULL'],
          `ALTER TABLE "my_table_name"
  ADD CONSTRAINT "my_constraint_name" CHECK name IS NOT NULL;`,
        ],
        // should not add constraint name if not defined
        [
          'should not add constraint name if not defined 1',
          options1,
          ['myTableName', null, 'CHECK name IS NOT NULL'],
          `ALTER TABLE "myTableName"
  ADD CHECK name IS NOT NULL;`,
        ],
        [
          'should not add constraint name if not defined 2',
          options2,
          ['myTableName', null, 'CHECK name IS NOT NULL'],
          `ALTER TABLE "my_table_name"
  ADD CHECK name IS NOT NULL;`,
        ],
        // should create comments
        [
          'should create comments 1',
          options1,
          [
            'myTableName',
            'myConstraintName',
            {
              primaryKey: 'colA',
              comment: 'this is an important primary key',
            },
          ],
          `ALTER TABLE "myTableName"
  ADD CONSTRAINT "myConstraintName" PRIMARY KEY ("colA");
COMMENT ON CONSTRAINT "myConstraintName" ON "myTableName" IS $pga$this is an important primary key$pga$;`,
        ],
        [
          'should create comments 2',
          options2,
          [
            'myTableName',
            'myConstraintName',
            {
              primaryKey: 'colA',
              comment: 'this is an important primary key',
            },
          ],
          `ALTER TABLE "my_table_name"
  ADD CONSTRAINT "my_constraint_name" PRIMARY KEY ("col_a");
COMMENT ON CONSTRAINT "my_constraint_name" ON "my_table_name" IS $pga$this is an important primary key$pga$;`,
        ],
      ] as const)(
        '%s',
        (
          _,
          optionPreset,
          [tableName, constraintName, expression],
          expected
        ) => {
          const addConstraintFn = addConstraint(optionPreset);
          const statement = addConstraintFn(
            tableName,
            constraintName,
            expression
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(expected);
        }
      );

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

        it('should throw error when constraintName is null', () => {
          expect(() =>
            addConstraintFn.reverse('distributors', null, {})
          ).toThrow(
            new Error(
              'Impossible to automatically infer down migration for addConstraint without naming constraint'
            )
          );
        });

        it('should throw error when expression is raw SQL', () => {
          expect(() =>
            addConstraintFn.reverse(
              'distributors',
              'zipchk',
              'CHECK (char_length(zipcode) = 5)'
            )
          ).toThrow(
            new Error(
              'Impossible to automatically infer down migration for addConstraint with raw SQL expression'
            )
          );
        });
      });
    });
  });
});
