import { describe, expect, it } from 'vitest';
import { renameType } from '../../../src/operations/types';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('types', () => {
    describe('renameType', () => {
      const renameTypeFn = renameType(options1);

      it('should return a function', () => {
        expect(renameTypeFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renameTypeFn('electronic_mail', 'email');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TYPE "electronic_mail" RENAME TO "email";'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = renameTypeFn(
          { name: 'electronic_mail', schema: 'myschema' },
          { name: 'email', schema: 'myschema' }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TYPE "myschema"."electronic_mail" RENAME TO "myschema"."email";'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameTypeFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameTypeFn.reverse('electronic_mail', 'email');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER TYPE "email" RENAME TO "electronic_mail";'
          );
        });
      });
    });
  });
});
