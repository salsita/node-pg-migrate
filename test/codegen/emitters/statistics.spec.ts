import { describe, expect, it } from 'vitest';
import { emitStatistics } from '../../../src/codegen/emitters/statistics';
import { makeStatistics } from '../../introspect/objects';
import { expectFallback, expectSql } from '../expectations';
import { emitAndRun } from '../run';

const ORDERS = { schema: 'kitchen', name: 'orders' };
const DEFINITION =
  'CREATE STATISTICS kitchen.orders_stats (dependencies) ON customer_id, status FROM kitchen.orders';

describe('emitStatistics', () => {
  it('creates extended statistics with pg_get_statisticsobjdef', () => {
    const result = emitAndRun(
      emitStatistics,
      makeStatistics(ORDERS, 'orders_stats', DEFINITION, {
        comment: 'Set by a comment step',
      })
    );

    expectFallback(result, 'extended statistics');
    expect(result.calls).toStrictEqual(['sql']);
    expectSql(result, DEFINITION);
  });

  it('sets the statistics target after creating the statistics', () => {
    const result = emitAndRun(
      emitStatistics,
      makeStatistics(ORDERS, 'orders_stats', DEFINITION, {
        statisticsTarget: 500,
      })
    );

    expectFallback(result, 'extended statistics');
    expectSql(
      result,
      `${DEFINITION};
       ALTER STATISTICS "kitchen"."orders_stats" SET STATISTICS 500;`
    );
  });
});
