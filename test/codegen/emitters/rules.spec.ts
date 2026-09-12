import { describe, expect, it } from 'vitest';
import { emitRule } from '../../../src/codegen/emitters/rules';
import { makeRule } from '../../introspect/objects';
import {
  expectFallback,
  expectSql,
  expectSqlThenAnyOrder,
} from '../expectations';
import { emitAndRun } from '../run';

const ORDERS = { schema: 'kitchen', name: 'orders' };
const DEFINITION =
  'CREATE RULE orders_no_delete AS\n    ON DELETE TO kitchen.orders DO INSTEAD NOTHING;';

describe('emitRule', () => {
  it('creates a rule with pg_get_ruledef', () => {
    const result = emitAndRun(
      emitRule,
      makeRule(ORDERS, 'orders_no_delete', DEFINITION, {
        comment: 'Set by a comment step',
      })
    );

    expectFallback(result, 'rule');
    expect(result.calls).toStrictEqual(['sql']);
    expectSql(result, DEFINITION);
  });

  it.each([
    ['DISABLED', 'DISABLE RULE'],
    ['REPLICA', 'ENABLE REPLICA RULE'],
    ['ALWAYS', 'ENABLE ALWAYS RULE'],
  ] as const)(
    'sets the firing mode %s after creating the rule',
    (enabled, action) => {
      const result = emitAndRun(
        emitRule,
        makeRule(ORDERS, 'orders_no_delete', DEFINITION, { enabled })
      );

      expectFallback(result, 'rule');
      expectSqlThenAnyOrder(
        result,
        `${DEFINITION}
       ALTER TABLE "kitchen"."orders" ${action} "orders_no_delete";`
      );
    }
  );
});
