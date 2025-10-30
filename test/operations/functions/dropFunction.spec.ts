import { describe, expect, it } from 'vitest';
import { dropFunction } from '../../../src/operations/functions';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('functions', () => {
    describe('dropFunction', () => {
      const dropFunctionFn = dropFunction(options1);

      it('should return a function', () => {
        expect(dropFunctionFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropFunctionFn('sqrt', ['integer']);

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP FUNCTION "sqrt"(integer);');
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropFunctionFn('sqrt', ['integer'], {
          ifExists: true,
          cascade: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'DROP FUNCTION IF EXISTS "sqrt"(integer) CASCADE;'
        );
      });

      it('should ignore default values in function parameters when dropping function', () => {
        const params = [
          {
            name: 'x',
            type: 'integer',
            default: 10,
          },
        ];

        const statement = dropFunctionFn('func_with_default', params);

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'DROP FUNCTION "func_with_default"("x" integer);'
        );
      });
    });
  });
});
