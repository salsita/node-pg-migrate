import { describe, expect, it } from 'vitest';
import { createOperator } from '../../../src/operations/operators';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('operators', () => {
    describe('createOperator', () => {
      const createOperatorFn = createOperator(options1);

      it('should return a function', () => {
        expect(createOperatorFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = createOperatorFn('===', {
          left: 'box',
          right: 'box',
          procedure: 'area_equal_function',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE OPERATOR === (PROCEDURE = "area_equal_function", LEFTARG = "box", RIGHTARG = "box");'
        );
      });

      it('should return sql statement with operatorOptions', () => {
        const statement = createOperatorFn('===', {
          left: 'box',
          right: 'box',
          procedure: 'area_equal_function',
          commutator: '===',
          negator: '!==',
          restrict: 'area_restriction_function',
          join: 'area_join_function',
          hashes: true,
          merges: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE OPERATOR === (PROCEDURE = "area_equal_function", LEFTARG = "box", RIGHTARG = "box", COMMUTATOR = ===, NEGATOR = !==, RESTRICT = "area_restriction_function", JOIN = "area_join_function", HASHES, MERGES);'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = createOperatorFn(
          { name: '===', schema: 'myschema' },
          {
            left: 'box',
            right: 'box',
            procedure: 'area_equal_function',
          }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE OPERATOR myschema.=== (PROCEDURE = "area_equal_function", LEFTARG = "box", RIGHTARG = "box");'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(createOperatorFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = createOperatorFn.reverse('===', {
            left: 'box',
            right: 'box',
            procedure: 'area_equal_function',
          });

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('DROP OPERATOR ===("box", "box");');
        });
      });
    });
  });
});
