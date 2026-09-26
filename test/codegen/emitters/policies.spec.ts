import { describe, expect, it } from 'vitest';
import { emitPolicy } from '../../../src/codegen/emitters/policies';
import type { Policy } from '../../../src/introspect/types';
import { makePolicy } from '../../introspect/objects';
import { expectCode, expectFallback, expectSql } from '../expectations';
import { emitAndRun } from '../run';

const DOCUMENTS = { schema: 'kitchen', name: 'documents' };

describe('emitPolicy', () => {
  it.each<[string, Policy, string]>([
    [
      'a policy for every command and role',
      makePolicy(DOCUMENTS, 'documents_tenant_isolation', {
        using: '(tenant_id = kitchen.current_tenant())',
        check: '(tenant_id = kitchen.current_tenant())',
        comment: 'Set by a comment step',
      }),
      `CREATE POLICY "documents_tenant_isolation" ON "kitchen"."documents" FOR ALL TO PUBLIC
       USING ((tenant_id = kitchen.current_tenant()))
       WITH CHECK ((tenant_id = kitchen.current_tenant()));`,
    ],
    [
      'a policy for one command and some roles',
      makePolicy({ schema: 'public', name: 'documents' }, 'documents_read', {
        command: 'SELECT',
        roles: ['admin', 'app_user'],
        using: 'is_public',
      }),
      'CREATE POLICY "documents_read" ON "documents" FOR SELECT TO admin, app_user USING (is_public);',
    ],
    [
      'an INSERT policy with a check only',
      makePolicy(DOCUMENTS, 'documents_insert', {
        command: 'INSERT',
        check: '(owner_name = CURRENT_USER)',
      }),
      'CREATE POLICY "documents_insert" ON "kitchen"."documents" FOR INSERT TO PUBLIC WITH CHECK ((owner_name = CURRENT_USER));',
    ],
  ])('creates %s with pgm.createPolicy', (_, policy, expected) => {
    const result = emitAndRun(emitPolicy, policy);

    expectCode(result);
    expect(result.calls).toStrictEqual(['createPolicy']);
    expectSql(result, expected);
  });

  it.each<[string, Policy, string]>([
    [
      'for one command and role',
      makePolicy(DOCUMENTS, 'documents_owner_delete', {
        command: 'DELETE',
        permissive: false,
        roles: ['app_user'],
        using: '(owner_name = CURRENT_USER)',
      }),
      'CREATE POLICY "documents_owner_delete" ON "kitchen"."documents" AS RESTRICTIVE FOR DELETE TO app_user USING ((owner_name = CURRENT_USER));',
    ],
    [
      'for every command and role',
      makePolicy(DOCUMENTS, 'documents_guard', {
        permissive: false,
        using: '(NOT is_locked)',
        check: '(NOT is_locked)',
      }),
      'CREATE POLICY "documents_guard" ON "kitchen"."documents" AS RESTRICTIVE USING ((NOT is_locked)) WITH CHECK ((NOT is_locked));',
    ],
  ])(
    'falls back to CREATE POLICY for a restrictive policy %s',
    (_, policy, expected) => {
      const result = emitAndRun(emitPolicy, policy);

      expectFallback(result, 'restrictive policy');
      expect(result.calls).toStrictEqual(['sql']);
      expectSql(result, expected);
    }
  );
});
