import { describe, expect, it } from 'vitest';
import { alterPolicy } from '../../../src/operations/policies';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('policies', () => {
    describe('alterPolicy', () => {
      const alterPolicyFn = alterPolicy(options1);

      it('should return a function', () => {
        expect(alterPolicyFn).toBeTypeOf('function');
      });

      it('should throw error when no policy options are provided', () => {
        expect(() => alterPolicyFn('my_table', 'p1', {})).toThrow(
          new Error('No policy options provided for alterPolicy')
        );
      });

      it('should return sql statement with policyOptions', () => {
        const statement = alterPolicyFn('my_table', 'p1', {
          role: 'CURRENT_USER',
          check: 'true',
          using: 'true',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER POLICY "p1" ON "my_table" TO CURRENT_USER USING (true) WITH CHECK (true);'
        );
      });
    });
  });
});
