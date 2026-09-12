import { describe, expect, it } from 'vitest';
import { emitMaterializedView } from '../../../src/codegen/emitters/materializedViews';
import { makeMaterializedView } from '../../introspect/objects';
import {
  expectCode,
  expectFallback,
  expectSql,
  expectSqlOneOf,
} from '../expectations';
import { emitAndRun } from '../run';

const DEFINITION =
  ' SELECT id AS customer_id,\n    kitchen.order_count(id) AS order_count\n   FROM kitchen.customers c';

describe('emitMaterializedView', () => {
  it('creates a materialized view with pgm.createMaterializedView', () => {
    const result = emitAndRun(
      emitMaterializedView,
      makeMaterializedView('kitchen', 'customer_totals', DEFINITION, {
        comment: 'Set by a comment step',
        columns: [{ name: 'customer_id', comment: 'Set by a comment step' }],
      })
    );

    expectCode(result);
    expect(result.calls).toStrictEqual(['createMaterializedView']);
    expectSql(
      result,
      `CREATE MATERIALIZED VIEW "kitchen"."customer_totals" AS ${DEFINITION};`
    );
  });

  it('falls back to CREATE MATERIALIZED VIEW for storage parameters', () => {
    const result = emitAndRun(
      emitMaterializedView,
      makeMaterializedView('kitchen', 'customer_totals', DEFINITION, {
        options: ['autovacuum_enabled=false', 'fillfactor=90'],
      })
    );

    expectFallback(result, 'storage parameters');
    expect(result.calls).toStrictEqual(['sql']);
    expectSqlOneOf(result, [
      `CREATE MATERIALIZED VIEW "kitchen"."customer_totals" WITH (autovacuum_enabled=false, fillfactor=90) AS ${DEFINITION};`,
      `CREATE MATERIALIZED VIEW "kitchen"."customer_totals" WITH (autovacuum_enabled=false, fillfactor=90) AS ${DEFINITION} WITH NO DATA;`,
    ]);
  });

  it('falls back to CREATE MATERIALIZED VIEW for a table access method', () => {
    const result = emitAndRun(
      emitMaterializedView,
      makeMaterializedView('kitchen', 'customer_totals', DEFINITION, {
        accessMethod: 'columnar',
      })
    );

    expectFallback(result, 'access method');
    expect(result.calls).toStrictEqual(['sql']);
    expectSqlOneOf(result, [
      `CREATE MATERIALIZED VIEW "kitchen"."customer_totals" USING columnar AS ${DEFINITION};`,
      `CREATE MATERIALIZED VIEW "kitchen"."customer_totals" USING columnar AS ${DEFINITION} WITH NO DATA;`,
    ]);
  });
});
