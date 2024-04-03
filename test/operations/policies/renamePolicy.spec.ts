import { describe, expect, it } from 'vitest';
import { renamePolicy } from '../../../src/operations/policies';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('policies', () => {
    describe('renamePolicy', () => {
      const renamePolicyFn = renamePolicy(options1);

      it('should return a function', () => {
        expect(renamePolicyFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renamePolicyFn('my_table', 'p1', 'p2');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER POLICY "p1" ON "my_table" RENAME TO "p2";'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = renamePolicyFn(
          { name: 'my_table', schema: 'myschema' },
          'p1',
          'p2'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER POLICY "p1" ON "myschema"."my_table" RENAME TO "p2";'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renamePolicyFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renamePolicyFn.reverse('my_table', 'p1', 'p2');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER POLICY "p2" ON "my_table" RENAME TO "p1";'
          );
        });
      });
    });
  });
});
