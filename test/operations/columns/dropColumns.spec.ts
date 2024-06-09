import { describe, expect, it } from 'vitest';
import { dropColumns } from '../../../src/operations/tables';
import { options1, options2 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('columns', () => {
    describe('dropColumns', () => {
      const dropColumnsFn = dropColumns(options1);

      it('should return a function', () => {
        expect(dropColumnsFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropColumnsFn('distributors', 'address');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `ALTER TABLE "distributors"
  DROP "address";`
        );
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropColumnsFn(
          'distributors',
          {
            address: 'varchar(30)',
          },
          {
            ifExists: true,
            cascade: true,
          }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER TABLE "distributors"
  DROP IF EXISTS "address" CASCADE;`);
      });

      it('should return sql statement with schema', () => {
        const statement = dropColumnsFn(
          {
            schema: 'myschema',
            name: 'distributors',
          },
          {
            address: 'varchar(30)',
          }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER TABLE "myschema"."distributors"
  DROP "address";`);
      });

      it.each([
        // should drop multiple columns
        [
          'should drop multiple columns 1',
          options1,
          ['myTableName', ['colC1', 'colC2']],
          `ALTER TABLE "myTableName"
  DROP "colC1",
  DROP "colC2";`,
        ],
        [
          'should drop multiple columns 2',
          options2,
          ['myTableName', ['colC1', 'colC2']],
          `ALTER TABLE "my_table_name"
  DROP "col_c1",
  DROP "col_c2";`,
        ],
      ] as const)('%s', (_, optionPreset, [tableName, columns], expected) => {
        const dropColumnsFn = dropColumns(optionPreset);
        const statement = dropColumnsFn(
          tableName,
          // @ts-expect-error: ignore readonly
          columns
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(expected);
      });
    });
  });
});
