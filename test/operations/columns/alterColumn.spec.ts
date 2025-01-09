import { describe, expect, it } from 'vitest';
import { alterColumn } from '../../../src/operations/tables';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('columns', () => {
    describe('alterColumn', () => {
      const alterColumnFn = alterColumn(options1);

      it('should return a function', () => {
        expect(alterColumnFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = alterColumnFn('distributors', 'address', {});

        expect(statement).toBeTypeOf('string');
        expect(statement).toHaveLength(0);
      });

      it('should return sql statement with columnOptions', () => {
        const statement = alterColumnFn('distributors', 'address', {
          default: null,
          type: 'varchar(30)',
          collation: 'C',
          using: 'address::text',
          notNull: false,
          sequenceGenerated: null,
          comment: 'Address of the distributor',
        });
        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `ALTER TABLE "distributors"
  ALTER "address" DROP DEFAULT,
  ALTER "address" SET DATA TYPE varchar(30) COLLATE C USING address::text,
  ALTER "address" DROP NOT NULL,
  ALTER "address" DROP IDENTITY;
COMMENT ON COLUMN "distributors"."address" IS $pga$Address of the distributor$pga$;`
        );
      });

      it('should return sql statement with columnOptions and expressionGenerated', () => {
        const statement = alterColumnFn('distributors', 'address', {
          default: null,
          type: 'varchar(30)',
          collation: 'C',
          using: 'address::text',
          notNull: false,
          sequenceGenerated: null,
          comment: 'Address of the distributor',
          expressionGenerated: 'other+1',
        });
        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `ALTER TABLE "distributors"
  ALTER "address" DROP DEFAULT,
  ALTER "address" SET DATA TYPE varchar(30) COLLATE C USING address::text,
  ALTER "address" DROP NOT NULL,
  ALTER "address" DROP IDENTITY,
  ALTER "address" SET EXPRESSION AS (other+1);
COMMENT ON COLUMN "distributors"."address" IS $pga$Address of the distributor$pga$;`
        );
      });

      it('should return sql statement with columnOptions and drop expression', () => {
        const statement = alterColumnFn('distributors', 'address', {
          default: null,
          type: 'varchar(30)',
          collation: 'C',
          using: 'address::text',
          notNull: false,
          sequenceGenerated: null,
          comment: 'Address of the distributor',
          expressionGenerated: null,
        });
        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `ALTER TABLE "distributors"
  ALTER "address" DROP DEFAULT,
  ALTER "address" SET DATA TYPE varchar(30) COLLATE C USING address::text,
  ALTER "address" DROP NOT NULL,
  ALTER "address" DROP IDENTITY,
  ALTER "address" DROP EXPRESSION;
COMMENT ON COLUMN "distributors"."address" IS $pga$Address of the distributor$pga$;`
        );
      });
    });
  });
});
