import { describe, expect, it } from 'vitest';
import { dropColumns } from '../../../src/operations/tables';
import { options1 } from '../../utils';

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
  DROP IF EXISTS"address";`);
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
    });
  });
});
