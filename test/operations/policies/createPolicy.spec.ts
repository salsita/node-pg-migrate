import { describe, expect, expectTypeOf, it } from 'vitest';
import type { PolicyOptions } from '../../../src';
import { createPolicy } from '../../../src/operations/policies';
import { options1, options1Pretty } from '../../presetMigrationOptions';

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

      describe('comments', () => {
        it('exposes nullable comments', () => {
          expectTypeOf<PolicyOptions['comment']>().toEqualTypeOf<
            string | null | undefined
          >();
        });

        it('quotes comments on a schema-qualified table', () => {
          expect(
            createPolicyFn(
              { schema: 'app.schema', name: 'record"表' },
              'policy"名',
              { comment: 'note' }
            )
          ).toBe(
            'CREATE POLICY "policy""名" ON "app.schema"."record""表" FOR ALL TO PUBLIC;\nCOMMENT ON POLICY "policy""名" ON "app.schema"."record""表" IS $pga$note$pga$;'
          );
        });

        it.each([
          ['string', 'description', '$pga$description$pga$'],
          ['null', null, 'NULL'],
          ['empty string', '', '$pga$$pga$'],
        ] satisfies Array<[string, string | null, string]>)(
          'renders %s without discarding the comment',
          (_, comment, value) => {
            expect(createPolicyFn('records', 'p1', { comment })).toBe(
              `CREATE POLICY "p1" ON "records" FOR ALL TO PUBLIC;\nCOMMENT ON POLICY "p1" ON "records" IS ${value};`
            );
          }
        );

        it.each([options1, options1Pretty])(
          'places comments after the policy statement (pretty: $pretty)',
          (options) => {
            expect(
              createPolicy(options)('records', 'p1', {
                role: 'reader',
                using: 'id > 0',
                check: 'id < 10',
                comment: 'limited rows',
                as: 'RESTRICTIVE',
              })
            ).toBe(
              'CREATE POLICY "p1" ON "records" AS RESTRICTIVE FOR ALL TO reader USING (id > 0) WITH CHECK (id < 10);\nCOMMENT ON POLICY "p1" ON "records" IS $pga$limited rows$pga$;'
            );
          }
        );

        it('omits undefined comments', () => {
          expect(createPolicyFn('records', 'p1', { comment: undefined })).toBe(
            'CREATE POLICY "p1" ON "records" FOR ALL TO PUBLIC;'
          );
        });
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

        it('drops a commented policy during automatic reversal', () => {
          expect(
            createPolicyFn.reverse({ schema: 'app', name: 'records' }, 'p1', {
              comment: 'note',
              ifExists: true,
            })
          ).toBe('DROP POLICY IF EXISTS "p1" ON "app"."records";');
        });
      });
    });
  });
});
