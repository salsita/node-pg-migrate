import { describe, expect, it } from 'vitest';
import { createOperatorFamily } from '../../../src/operations/operators';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('operators', () => {
    describe('createOperatorFamily', () => {
      const createOperatorFamilyFn = createOperatorFamily(options1);

      it('should return a function', () => {
        expect(createOperatorFamilyFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = createOperatorFamilyFn('integer_ops', 'btree');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE OPERATOR FAMILY "integer_ops" USING btree;'
        );
      });

      it('should return sql statement with operatorFamilyOptions', () => {
        // TODO @Shinigami92 2024-03-08: originally there are no options: https://www.postgresql.org/docs/current/sql-createopfamily.html
        const statement = createOperatorFamilyFn('integer_ops', 'btree', {
          ifExists: true,
          cascade: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE OPERATOR FAMILY "integer_ops" USING btree;'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = createOperatorFamilyFn(
          { name: 'integer_ops', schema: 'myschema' },
          'btree'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE OPERATOR FAMILY "myschema"."integer_ops" USING btree;'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(createOperatorFamilyFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = createOperatorFamilyFn.reverse(
            'integer_ops',
            'btree'
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'DROP OPERATOR FAMILY "integer_ops" USING btree;'
          );
        });
      });
    });
  });
});
