import { describe, expect, it } from 'vitest';
import { PgType } from '../../../src';
import { addColumns } from '../../../src/operations/tables';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('columns', () => {
    describe('addColumns', () => {
      const addColumnsFn = addColumns(options1);

      it('should return a function', () => {
        expect(addColumnsFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = addColumnsFn('transactions', {
          status: {
            type: 'varchar(30)',
            default: 'old',
          },
          mtime: {
            type: PgType.TIMESTAMP_WITH_TIME_ZONE,
            default: 'now()',
          },
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER TABLE "transactions"
  ADD "status" varchar(30) DEFAULT $pga$old$pga$,
  ADD "mtime" timestamp with time zone DEFAULT $pga$now()$pga$;`);
      });

      it('should return sql statement with columnOptions', () => {
        const statement = addColumnsFn(
          'transactions',
          {
            status: {
              type: 'varchar(30)',
              default: 'old',
            },
          },
          {
            ifNotExists: true,
          }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER TABLE "transactions"
  ADD IF NOT EXISTS "status" varchar(30) DEFAULT $pga$old$pga$;`);
      });

      it('should return sql statement with schema', () => {
        const statement = addColumnsFn(
          { schema: 'myschema', name: 'distributors' },
          {
            status: PgType.VARCHAR,
          }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `ALTER TABLE "myschema"."distributors"
  ADD "status" varchar;`
        );
      });

      it('should support unbounded array column type option', () => {
        const statement = addColumnsFn('transactions', {
          tags: {
            type: PgType.TEXT,
            array: true,
          },
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER TABLE "transactions"
  ADD "tags" text ARRAY;`);
      });

      it('should pass numeric array dimensions through to SQL', () => {
        const arrayDimension = 17;

        const statement = addColumnsFn('transactions', {
          scores: {
            type: PgType.INTEGER,
            array: arrayDimension,
          },
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER TABLE "transactions"
  ADD "scores" integer ARRAY[${arrayDimension}];`);
      });

      it('should support array option for different column types', () => {
        const statement = addColumnsFn('transactions', {
          ids: {
            type: PgType.UUID,
            array: true,
          },
          aliases: {
            type: 'varchar(30)',
            array: true,
          },
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER TABLE "transactions"
  ADD "ids" uuid ARRAY,
  ADD "aliases" varchar(30) ARRAY;`);
      });

      it('should keep string-based array type declarations unchanged', () => {
        const statement = addColumnsFn('transactions', {
          tags: {
            type: `${PgType.TEXT}[]`,
          },
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER TABLE "transactions"
  ADD "tags" text[];`);
      });

      it('should ignore false array option', () => {
        const statement = addColumnsFn('transactions', {
          description: {
            type: PgType.TEXT,
            array: false,
          },
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER TABLE "transactions"
  ADD "description" text;`);
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(addColumnsFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = addColumnsFn.reverse('transactions', {
            status: {
              type: 'varchar(30)',
              default: 'old',
            },
          });

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(`ALTER TABLE "transactions"
  DROP "status";`);
        });
      });
    });
  });
});
