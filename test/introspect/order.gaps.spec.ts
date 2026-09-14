import { describe, expect, it } from 'vitest';
import {
  objectIdentity,
  orderObjects,
  PHASES,
} from '../../src/introspect/core/order';
import type { ModelObject, OrderedObject } from '../../src/introspect/types';
import {
  dependsOn,
  makeAggregate,
  makeCast,
  makeConstraint,
  makeExtension,
  makeFunction,
  makeIndex,
  makeMaterializedView,
  makeOperator,
  makeSchema,
  makeSequence,
  makeStatistics,
  makeTable,
  makeTrigger,
  makeView,
  modelOf,
} from './objects';

function names(steps: ReadonlyArray<OrderedObject>): string[] {
  return steps.map((step) => {
    if (step.step === 'prologue' || step.step === 'epilogue') {
      return step.step;
    }

    if (step.step === 'comment') {
      return `comment ${step.object.on} ${objectIdentity(step.object.object)}`;
    }

    return `${step.step} ${objectIdentity(step.object)}`;
  });
}

function thrownBy(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }

  return undefined;
}

describe('orderObjects', () => {
  it('waits for the table, view or materialized view of an object even without a recorded dependency', () => {
    const totals = makeMaterializedView('public', 'totals', ' SELECT 1 AS n');
    const view = makeView('public', 'v', ' SELECT 1 AS n');
    const orders = makeTable('public', 'orders');
    const lines = makeTable('public', 'lines');
    const model = modelOf([
      makeIndex(totals, 'totals_n_idx'),
      makeTrigger(view, 'v_insert', { timing: 'INSTEAD OF' }),
      makeStatistics(
        orders,
        'orders_stats',
        'CREATE STATISTICS public.orders_stats ON id, id FROM public.orders'
      ),
      makeConstraint(
        lines,
        'lines_order_fkey',
        'foreignKey',
        'FOREIGN KEY (id) REFERENCES public.orders(id)',
        {
          references: { schema: 'public', name: 'orders' },
        }
      ),
      makeSequence('public', 'a_seq', {
        ownedBy: { table: { schema: 'public', name: 'orders' }, column: 'id' },
      }),
      totals,
      view,
      orders,
      lines,
    ]);

    expect(names(orderObjects(model))).toStrictEqual([
      'prologue',
      'create public.a_seq',
      'create public.lines',
      'create public.orders',
      'sequenceOwnership public.a_seq',
      'create lines_order_fkey on public.lines',
      'create public.totals',
      'create public.totals_n_idx',
      'create public.v',
      'create v_insert on public.v',
      'create public.orders_stats',
      'epilogue',
    ]);
  });

  it('ignores dependencies on objects that are not in the model', () => {
    const table = makeTable('public', 't');
    const model = modelOf(
      [table],
      [
        dependsOn(table, { kind: 'function', oid: 1 }),
        dependsOn({ kind: 'view', oid: 2 }, table),
      ]
    );

    expect(names(orderObjects(model))).toStrictEqual([
      'prologue',
      'create public.t',
      'epilogue',
    ]);
  });

  it('puts every step of every kind in its phase and sets the comments of objects of every kind last', () => {
    const table = makeTable('public', 't');
    const cast = makeCast('text', 'public.money', { comment: 'Cast' });
    const objects: ModelObject[] = [
      makeSchema('app', { comment: 'App' }),
      makeExtension('app', 'pg_trgm'),
      makeOperator('app', '===', { comment: 'Op' }),
      makeAggregate('app', 'agg', { comment: 'Agg' }),
      cast,
      table,
      makeConstraint(table, 't_pkey', 'primaryKey', 'PRIMARY KEY (id)', {
        comment: 'Key',
        indexComment: 'Key index',
      }),
    ];

    expect(names(orderObjects(modelOf(objects)))).toStrictEqual([
      'prologue',
      'create app',
      'create app.pg_trgm',
      'create app.===(integer, integer)',
      'create (text AS public.money)',
      'create app.agg(text)',
      'create public.t',
      'create t_pkey on public.t',
      'comment object app.===(integer, integer)',
      'comment object app.agg(text)',
      'comment object app',
      'comment object t_pkey on public.t',
      'comment constraintIndex t_pkey on public.t',
      'comment object (text AS public.money)',
      'epilogue',
    ]);
    expect(
      orderObjects(modelOf(objects)).filter(
        (step) => step.phase === PHASES.comments
      )
    ).toHaveLength(6);
  });

  it('names the objects of every cycle, and not the ones that only wait for a cycle', () => {
    const a = makeFunction('public', 'a_fn');
    const b = makeView('public', 'b_view', ' SELECT 1');
    const c = makeFunction('public', 'c_fn');
    const d = makeView('public', 'd_view', ' SELECT 1');
    const downstream = makeView('public', 'downstream', ' SELECT 1');
    const between = makeFunction('public', 'between_fn');
    const model = modelOf(
      [a, b, c, d, downstream, between],
      [
        dependsOn(a, b),
        dependsOn(b, a),
        dependsOn(c, d),
        dependsOn(d, c),
        dependsOn(downstream, a),
        dependsOn(between, b),
        dependsOn(c, between),
      ]
    );

    const message = String(thrownBy(() => orderObjects(model)));

    expect(message).toContain('function public.a_fn(), view public.b_view');
    expect(message).toContain('function public.c_fn(), view public.d_view');
    expect(message).not.toContain('downstream');
    expect(message).not.toContain('between_fn');
  });

  it('names a materialized view of a cycle readably', () => {
    const view = makeMaterializedView('public', 'mv', ' SELECT 1');
    const fn = makeFunction('public', 'fn');
    const message = String(
      thrownBy(() =>
        orderObjects(
          modelOf([view, fn], [dependsOn(view, fn), dependsOn(fn, view)])
        )
      )
    );

    expect(message).toContain('materialized view public.mv');
  });
});

describe('objectIdentity', () => {
  it.each<[ModelObject, string]>([
    [makeSchema('app'), 'app'],
    [makeCast('text', 'integer'), '(text AS integer)'],
    [
      makeFunction('app', 'f', { identityArguments: 'a integer' }),
      'app.f(a integer)',
    ],
    [makeTrigger({ schema: 'app', name: 't' }, 'trg'), 'trg on app.t'],
    [makeIndex({ schema: 'app', name: 't' }, 't_idx'), 'app.t_idx'],
  ])('names %o as %s', (object, expected) => {
    expect(objectIdentity(object)).toBe(expected);
  });
});
