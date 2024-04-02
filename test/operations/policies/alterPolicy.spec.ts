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

      // TODO @Shinigami92 2024-03-09: This should throw an error
      it('should return sql statement', () => {
        const statement = alterPolicyFn('my_table', 'p1', {});

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('ALTER POLICY "p1" ON "my_table" ;');
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
