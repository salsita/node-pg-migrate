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

// Materialized views are created unpopulated (WITH NO DATA), like pg_dump and
// the SQL baseline do: creating one never runs its query, so what the query
// reads (through functions too) may be created after it.

describe('emitMaterializedView', () => {
  it('creates a materialized view WITH NO DATA with pgm.createMaterializedView', () => {
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
      `CREATE MATERIALIZED VIEW "kitchen"."customer_totals" AS ${DEFINITION} WITH NO DATA;`
    );
  });

  it('falls back to CREATE MATERIALIZED VIEW … WITH NO DATA for storage parameters', () => {
    const result = emitAndRun(
      emitMaterializedView,
      makeMaterializedView('kitchen', 'customer_totals', DEFINITION, {
        options: ['autovacuum_enabled=false', 'fillfactor=90'],
      })
    );

    expectFallback(result, 'storage parameters');
    expect(result.calls).toStrictEqual(['sql']);
    expectSql(
      result,
      `CREATE MATERIALIZED VIEW "kitchen"."customer_totals" WITH (autovacuum_enabled=false, fillfactor=90) AS ${DEFINITION} WITH NO DATA;`
    );
  });

  it('falls back to CREATE MATERIALIZED VIEW … WITH NO DATA for a table access method', () => {
    const result = emitAndRun(
      emitMaterializedView,
      makeMaterializedView('kitchen', 'customer_totals', DEFINITION, {
        accessMethod: 'columnar',
      })
    );

    expectFallback(result, 'access method');
    expect(result.calls).toStrictEqual(['sql']);
    expectSql(
      result,
      `CREATE MATERIALIZED VIEW "kitchen"."customer_totals" USING columnar AS ${DEFINITION} WITH NO DATA;`
    );
  });

  it('writes the namespace of a TOAST storage parameter apart from its name, like pg_dump', () => {
    const result = emitAndRun(
      emitMaterializedView,
      makeMaterializedView('kitchen', 'customer_totals', DEFINITION, {
        options: ['toast.autovacuum_enabled=false'],
      })
    );

    expectFallback(result, 'storage parameters');
    expectSqlOneOf(result, [
      `CREATE MATERIALIZED VIEW "kitchen"."customer_totals" WITH (toast.autovacuum_enabled='false') AS ${DEFINITION} WITH NO DATA;`,
      `CREATE MATERIALIZED VIEW "kitchen"."customer_totals" WITH (toast.autovacuum_enabled='false') AS ${DEFINITION};`,
    ]);
  });
});
