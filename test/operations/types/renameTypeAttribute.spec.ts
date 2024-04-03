import { describe, expect, it } from 'vitest';
import { renameTypeAttribute } from '../../../src/operations/types';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('types', () => {
    describe('renameTypeAttribute', () => {
      const renameTypeAttributeFn = renameTypeAttribute(options1);

      it('should return a function', () => {
        expect(renameTypeAttributeFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renameTypeAttributeFn('compfoo', 'f3', 'f4');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TYPE "compfoo" RENAME ATTRIBUTE "f3" TO "f4";'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = renameTypeAttributeFn(
          { name: 'compfoo', schema: 'myschema' },
          'f3',
          'f4'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TYPE "myschema"."compfoo" RENAME ATTRIBUTE "f3" TO "f4";'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameTypeAttributeFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameTypeAttributeFn.reverse(
            'compfoo',
            'f3',
            'f4'
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER TYPE "compfoo" RENAME ATTRIBUTE "f4" TO "f3";'
          );
        });
      });
    });
  });
});
