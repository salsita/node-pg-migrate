import { describe, expect, it } from 'vitest';
import { emitComment } from '../../../src/codegen/emitters/comments';
import type { ModelObject, ObjectComment } from '../../../src/introspect/types';
import {
  makeAggregate,
  makeCast,
  makeCollation,
  makeComposite,
  makeConstraint,
  makeDomain,
  makeEnum,
  makeFunction,
  makeIndex,
  makeMaterializedView,
  makeOperator,
  makePolicy,
  makeRange,
  makeRule,
  makeSchema,
  makeSequence,
  makeStatistics,
  makeTrigger,
  makeView,
} from '../../introspect/objects';
import { expectFallback, expectSql } from '../expectations';
import { emitAndRun } from '../run';

const TEXT = 'It\'s a "test",\n\\connect -- not a command, $$ {name} ${x}';

/**
 * `TEXT` as a standard SQL string literal.
 */
const LITERAL = `'${TEXT.replaceAll("'", "''")}'`;

const ORDERS = { schema: 'kitchen', name: 'orders' };
const view = makeView(
  'kitchen',
  'order_summary',
  ' SELECT 1 AS "Total Amount"'
);
const domain = makeDomain('kitchen', 'money', 'numeric');

function on(
  object: Exclude<ModelObject, { kind: 'table' | 'extension' }>
): ObjectComment {
  return { on: 'object', object, text: TEXT };
}

describe('emitComment', () => {
  it.each<[string, ObjectComment, string, string]>([
    ['a schema', on(makeSchema('kitchen')), 'SCHEMA "kitchen"', 'schema'],
    [
      'an enum',
      on(makeEnum('kitchen', 'mood', ['ok'])),
      'TYPE "kitchen"."mood"',
      'type',
    ],
    [
      'a composite type',
      on(
        makeComposite('kitchen', 'address', [{ name: 'street', type: 'text' }])
      ),
      'TYPE "kitchen"."address"',
      'type',
    ],
    [
      'a range type',
      on(makeRange('kitchen', 'float_range', 'double precision')),
      'TYPE "kitchen"."float_range"',
      'type',
    ],
    ['a domain', on(domain), 'DOMAIN "kitchen"."money"', 'domain'],
    [
      'a collation',
      on(makeCollation('kitchen', 'ci')),
      'COLLATION "kitchen"."ci"',
      'collation',
    ],
    [
      'a sequence',
      on(makeSequence('kitchen', 'ticket_seq')),
      'SEQUENCE "kitchen"."ticket_seq"',
      'sequence',
    ],
    [
      'a function',
      on(
        makeFunction('kitchen', 'customer_order_total', {
          identityArguments: 'p_customer_id bigint',
        })
      ),
      'FUNCTION "kitchen"."customer_order_total"(p_customer_id bigint)',
      'function',
    ],
    [
      'a window function',
      on(makeFunction('kitchen', 'running_total', { routineKind: 'window' })),
      'FUNCTION "kitchen"."running_total"()',
      'function',
    ],
    [
      'a procedure',
      on(
        makeFunction('kitchen', 'archive_orders', {
          routineKind: 'procedure',
          identityArguments: 'p_before date',
        })
      ),
      'PROCEDURE "kitchen"."archive_orders"(p_before date)',
      'procedure',
    ],
    [
      'an aggregate',
      on(makeAggregate('kitchen', 'pipe_agg')),
      'AGGREGATE "kitchen"."pipe_agg"(text)',
      'aggregate',
    ],
    [
      'an aggregate without arguments',
      on(
        makeAggregate('kitchen', 'count_all', {
          identityArguments: '',
          argumentTypes: [],
        })
      ),
      'AGGREGATE "kitchen"."count_all"(*)',
      'aggregate',
    ],
    [
      'an operator',
      on(
        makeOperator('kitchen', '=~=', {
          identityArguments: 'numeric, numeric',
        })
      ),
      'OPERATOR "kitchen".=~= (numeric, numeric)',
      'operator',
    ],
    [
      'a cast',
      on(makeCast('character varying', 'integer')),
      'CAST (character varying AS integer)',
      'cast',
    ],
    [
      'a constraint',
      on(
        makeConstraint(ORDERS, 'orders_pkey', 'primaryKey', 'PRIMARY KEY (id)')
      ),
      'CONSTRAINT "orders_pkey" ON "kitchen"."orders"',
      'constraint',
    ],
    [
      'an index',
      on(makeIndex(ORDERS, 'orders_idx')),
      'INDEX "kitchen"."orders_idx"',
      'index',
    ],
    ['a view', on(view), 'VIEW "kitchen"."order_summary"', 'view'],
    [
      'a view of the default schema',
      on(makeView('public', 'totals', ' SELECT 1')),
      'VIEW "public"."totals"',
      'view',
    ],
    [
      'a view whose names need quotes',
      on(makeView('Sink Área', 'From; View', ' SELECT 1')),
      'VIEW "Sink Área"."From; View"',
      'view',
    ],
    [
      'a materialized view',
      on(makeMaterializedView('kitchen', 'customer_totals', ' SELECT 1')),
      'MATERIALIZED VIEW "kitchen"."customer_totals"',
      'materialized view',
    ],
    [
      'a trigger',
      on(makeTrigger(ORDERS, 'orders_audit')),
      'TRIGGER "orders_audit" ON "kitchen"."orders"',
      'trigger',
    ],
    [
      'a policy',
      on(makePolicy(ORDERS, 'orders_owner')),
      'POLICY "orders_owner" ON "kitchen"."orders"',
      'policy',
    ],
    [
      'a rule',
      on(
        makeRule(
          ORDERS,
          'orders_no_delete',
          'CREATE RULE orders_no_delete AS\n    ON DELETE TO kitchen.orders DO INSTEAD NOTHING;'
        )
      ),
      'RULE "orders_no_delete" ON "kitchen"."orders"',
      'rule',
    ],
    [
      'extended statistics',
      on(
        makeStatistics(
          ORDERS,
          'orders_stats',
          'CREATE STATISTICS kitchen.orders_stats ON id, placed_at FROM kitchen.orders'
        )
      ),
      'STATISTICS "kitchen"."orders_stats"',
      'statistics',
    ],
    [
      'a column of a view',
      { on: 'column', object: view, column: 'Total Amount', text: TEXT },
      'COLUMN "kitchen"."order_summary"."Total Amount"',
      'column',
    ],
    [
      'a column of a materialized view',
      {
        on: 'column',
        object: makeMaterializedView(
          'kitchen',
          'customer_totals',
          ' SELECT 1 AS n'
        ),
        column: 'n',
        text: TEXT,
      },
      'COLUMN "kitchen"."customer_totals"."n"',
      'column',
    ],
    [
      'an attribute of a composite type',
      {
        on: 'column',
        object: makeComposite('kitchen', 'address', [
          { name: 'street', type: 'text' },
        ]),
        column: 'street',
        text: TEXT,
      },
      'COLUMN "kitchen"."address"."street"',
      'column',
    ],
    [
      'a constraint of a domain',
      {
        on: 'domainConstraint',
        object: domain,
        constraint: 'money_positive',
        text: TEXT,
      },
      'CONSTRAINT "money_positive" ON DOMAIN "kitchen"."money"',
      'constraint',
    ],
    [
      'the index of a constraint',
      {
        on: 'constraintIndex',
        object: makeConstraint(
          ORDERS,
          'orders_pkey',
          'primaryKey',
          'PRIMARY KEY (id)'
        ),
        text: TEXT,
      },
      'INDEX "kitchen"."orders_pkey"',
      'index',
    ],
  ])('comments on %s with COMMENT ON', (_, comment, target, objectType) => {
    const result = emitAndRun(emitComment, comment);

    expectFallback(result, `comment on ${objectType}`);
    expect(result.calls).toStrictEqual(['sql']);
    expectSql(result, `COMMENT ON ${target} IS ${LITERAL};`);
  });
});
