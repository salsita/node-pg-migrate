import { describe, expect, it } from 'vitest';
import { createPolicy } from '../../../src/operations/policies';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('policies', () => {
    describe('createPolicy', () => {
      const createPolicyFn = createPolicy(options1);

      it('should return a function', () => {
        expect(createPolicyFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = createPolicyFn('my_table', 'p1');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE POLICY "p1" ON "my_table" FOR ALL TO PUBLIC;'
        );
      });

      it('should return sql statement with policyOptions', () => {
        const statement = createPolicyFn('my_table', 'p1', {
          role: 'CURRENT_USER',
          check: 'true',
          using: 'true',
          command: 'SELECT',
          ifExists: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE POLICY "p1" ON "my_table" FOR SELECT TO CURRENT_USER USING (true) WITH CHECK (true);'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = createPolicyFn(
          { name: 'my_table', schema: 'myschema' },
          'p1'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE POLICY "p1" ON "myschema"."my_table" FOR ALL TO PUBLIC;'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(createPolicyFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = createPolicyFn.reverse('my_table', 'p1');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('DROP POLICY "p1" ON "my_table";');
        });
      });
    });
  });
});
