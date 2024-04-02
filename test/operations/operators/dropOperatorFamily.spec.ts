import { describe, expect, it } from 'vitest';
import { dropOperatorFamily } from '../../../src/operations/operators';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('operators', () => {
    describe('dropOperatorFamily', () => {
      const dropOperatorFamilyFn = dropOperatorFamily(options1);

      it('should return a function', () => {
        expect(dropOperatorFamilyFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropOperatorFamilyFn('float_ops', 'btree');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP OPERATOR FAMILY "float_ops" USING btree;');
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropOperatorFamilyFn('float_ops', 'btree', {
          ifExists: true,
          cascade: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'DROP OPERATOR FAMILY IF EXISTS "float_ops" USING btree CASCADE;'
        );
      });
    });
  });
});
