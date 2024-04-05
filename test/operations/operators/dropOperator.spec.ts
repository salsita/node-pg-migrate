import { describe, expect, it } from 'vitest';
import { dropOperator } from '../../../src/operations/operators';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('operators', () => {
    describe('dropOperator', () => {
      const dropOperatorFn = dropOperator(options1);

      it('should return a function', () => {
        expect(dropOperatorFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropOperatorFn('^', {
          left: 'integer',
          right: 'integer',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP OPERATOR ^("integer", "integer");');
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropOperatorFn('~', {
          right: 'bit',
          ifExists: true,
          cascade: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'DROP OPERATOR IF EXISTS ~("none", "bit") CASCADE;'
        );
      });
    });
  });
});
