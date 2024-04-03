import { describe, expect, it } from 'vitest';
import { renameTypeValue } from '../../../src/operations/types';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('types', () => {
    describe('renameTypeValue', () => {
      const renameTypeValueFn = renameTypeValue(options1);

      it('should return a function', () => {
        expect(renameTypeValueFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renameTypeValueFn('colors', 'purple', 'mauve');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TYPE "colors" RENAME VALUE $pga$purple$pga$ TO $pga$mauve$pga$;'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = renameTypeValueFn(
          { name: 'colors', schema: 'myschema' },
          'purple',
          'mauve'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TYPE "myschema"."colors" RENAME VALUE $pga$purple$pga$ TO $pga$mauve$pga$;'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameTypeValueFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameTypeValueFn.reverse(
            'colors',
            'purple',
            'mauve'
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER TYPE "colors" RENAME VALUE $pga$mauve$pga$ TO $pga$purple$pga$;'
          );
        });
      });
    });
  });
});
