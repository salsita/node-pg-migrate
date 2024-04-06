import { describe, expect, it } from 'vitest';
import { renameFunction } from '../../../src/operations/functions';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('functions', () => {
    describe('renameFunction', () => {
      const renameFunctionFn = renameFunction(options1);

      it('should return a function', () => {
        expect(renameFunctionFn).toBeTypeOf('function');
      });

      it('should return sql statement with domainOptions default', () => {
        const statement = renameFunctionFn('sqrt', ['integer'], 'square_root');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER FUNCTION "sqrt"(integer) RENAME TO "square_root";'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameFunctionFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameFunctionFn.reverse(
            'sqrt',
            ['integer'],
            'square_root'
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER FUNCTION "square_root"(integer) RENAME TO "sqrt";'
          );
        });
      });
    });
  });
});
