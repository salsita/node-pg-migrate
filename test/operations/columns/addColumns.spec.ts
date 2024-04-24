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
