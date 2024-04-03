import { describe, expect, it } from 'vitest';
import { dropPolicy } from '../../../src/operations/policies';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('policies', () => {
    describe('dropPolicy', () => {
      const dropPolicyFn = dropPolicy(options1);

      it('should return a function', () => {
        expect(dropPolicyFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropPolicyFn('my_table', 'p1');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP POLICY "p1" ON "my_table";');
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropPolicyFn('my_table', 'p1', {
          ifExists: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP POLICY IF EXISTS "p1" ON "my_table";');
      });
    });
  });
});
