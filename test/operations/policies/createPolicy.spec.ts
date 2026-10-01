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

      it.each(['PERMISSIVE', 'RESTRICTIVE'] as const)(
        'should create an explicitly %s policy',
        (as) => {
          const statement = createPolicyFn('my_table', 'p1', { as });

          expect(statement).toBe(
            `CREATE POLICY "p1" ON "my_table" AS ${as} FOR ALL TO PUBLIC;`
          );
        }
      );

      it.each(['PERMISSIVE', 'RESTRICTIVE'] as const)(
        'should place AS %s before the command and other clauses',
        (as) => {
          const statement = createPolicyFn(
            { schema: 'my"schema', name: 'my"table' },
            'my"policy',
            {
              as,
              command: 'UPDATE',
              role: ['CURRENT_USER', 'SESSION_USER'],
              using: 'id > 0',
              check: 'id < 10',
            }
          );

          expect(statement).toBe(
            `CREATE POLICY "my""policy" ON "my""schema"."my""table" AS ${as} FOR UPDATE TO CURRENT_USER, SESSION_USER USING (id > 0) WITH CHECK (id < 10);`
          );
        }
      );

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(createPolicyFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = createPolicyFn.reverse('my_table', 'p1');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('DROP POLICY "p1" ON "my_table";');
        });

        it.each(['PERMISSIVE', 'RESTRICTIVE'] as const)(
          'should reverse an explicitly %s policy with drop options',
          (as) => {
            const statement = createPolicyFn.reverse(
              { schema: 'my"schema', name: 'my"table' },
              'my"policy',
              { as, ifExists: true }
            );

            expect(statement).toBe(
              'DROP POLICY IF EXISTS "my""policy" ON "my""schema"."my""table";'
            );
          }
        );
      });
    });
  });
});
