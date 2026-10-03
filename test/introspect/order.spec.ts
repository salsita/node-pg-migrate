import { describe, expect, it } from 'vitest';
import { BaselineError } from '../../src/baseline/errors';
import { orderObjects, PHASES } from '../../src/introspect/core/order';
import type {
  ModelObject,
  OrderedObject,
  SchemaModel,
} from '../../src/introspect/types';
import {
  dependsOn,
  makeAggregate,
  makeCast,
  makeCollation,
  makeColumn,
  makeComposite,
  makeConstraint,
  makeDomain,
  makeEnum,
  makeExtension,
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
  makeTable,
  makeTrigger,
  makeView,
  modelOf,
} from './objects';

function identify(object: ModelObject): string {
  if (object.kind === 'cast') {
    return `(${object.source} AS ${object.target})`;
  }

  const args =
    'identityArguments' in object ? `(${object.identityArguments})` : '';
  const table =
    'table' in object ? `@${object.table.schema}.${object.table.name}` : '';

  return `${object.schema}.${object.name}${args}${table}`;
}

/**
 * A readable label of a step, e.g. `create table public.orders`.
 */
function label(step: OrderedObject): string {
  if (step.step === 'prologue' || step.step === 'epilogue') {
    return step.step;
  }

  if (step.step === 'create') {
    return `create ${step.object.kind} ${identify(step.object)}`;
  }

  if (step.step === 'sequenceOwnership') {
    return `own ${identify(step.object)}`;
  }

  if (step.step === 'rowLevelSecurity') {
    return `rls ${identify(step.object)}`;
  }

  const comment = step.object;
  const detail =
    comment.on === 'column'
      ? `.${comment.column}`
      : comment.on === 'domainConstraint'
        ? `.${comment.constraint}`
        : '';

  return `comment ${comment.on} ${identify(comment.object)}${detail}`;
}

function labels(model: SchemaModel): string[] {
  return orderObjects(model).map(label);
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
  it('starts with the prologue and ends with the epilogue', () => {
    const steps = orderObjects(modelOf([]));

    expect(steps).toStrictEqual([
      { step: 'prologue', phase: PHASES.prologue },
      { step: 'epilogue', phase: PHASES.epilogue },
    ]);
  });

  it('puts every kind of object in its phase', () => {
    const table = makeTable('public', 'orders', {
      rowLevelSecurity: true,
    });
    const sequence = makeSequence('public', 'order_numbers', {
      ownedBy: { table: { schema: 'public', name: 'orders' }, column: 'id' },
    });
    const view = makeView('public', 'open_orders', ' SELECT 1', {
      comment: 'Open',
    });
    const objects: ModelObject[] = [
      makeSchema('kitchen'),
      makeExtension('public', 'pg_trgm'),
      makeEnum('public', 'mood', ['sad', 'ok']),
      makeComposite('public', 'address', [{ name: 'street', type: 'text' }]),
      makeDomain('public', 'amount', 'numeric'),
      makeRange('public', 'float_range', 'double precision'),
      makeCollation('public', 'ci'),
      sequence,
      makeFunction('public', 'total'),
      makeOperator('public', '=~='),
      makeCast('text', 'public.mood'),
      makeAggregate('public', 'pipe_agg'),
      table,
      makeConstraint(table, 'orders_pkey', 'primaryKey', 'PRIMARY KEY (id)'),
      makeConstraint(
        table,
        'orders_parent_fkey',
        'foreignKey',
        'FOREIGN KEY (id) REFERENCES public.orders(id)'
      ),
      makeIndex(table, 'orders_idx'),
      view,
      makeMaterializedView('public', 'totals', ' SELECT 1'),
      makeTrigger(table, 'orders_trg'),
      makePolicy(table, 'orders_policy'),
      makeRule(
        table,
        'orders_rule',
        'CREATE RULE orders_rule AS\n    ON DELETE TO public.orders DO INSTEAD NOTHING;'
      ),
      makeStatistics(
        table,
        'orders_stats',
        'CREATE STATISTICS public.orders_stats ON id, id FROM public.orders'
      ),
    ];
    const steps = orderObjects(modelOf(objects));

    const phaseOf = (wanted: string): number | undefined =>
      steps.find((step) => label(step).startsWith(wanted))?.phase;
    expect({
      schema: phaseOf('create schema'),
      extension: phaseOf('create extension'),
      enum: phaseOf('create enum'),
      composite: phaseOf('create composite'),
      domain: phaseOf('create domain'),
      range: phaseOf('create range'),
      collation: phaseOf('create collation'),
      sequence: phaseOf('create sequence'),
      function: phaseOf('create function'),
      operator: phaseOf('create operator'),
      cast: phaseOf('create cast'),
      aggregate: phaseOf('create aggregate'),
      table: phaseOf('create table'),
      ownership: phaseOf('own '),
      primaryKey: phaseOf('create constraint public.orders_pkey'),
      foreignKey: phaseOf('create constraint public.orders_parent_fkey'),
      index: phaseOf('create index'),
      view: phaseOf('create view'),
      materializedView: phaseOf('create materializedView'),
      trigger: phaseOf('create trigger'),
      rowLevelSecurity: phaseOf('rls '),
      policy: phaseOf('create policy'),
      rule: phaseOf('create rule'),
      statistics: phaseOf('create statistics'),
      comment: phaseOf('comment '),
    }).toStrictEqual({
      schema: PHASES.schemas,
      extension: PHASES.extensions,
      enum: PHASES.types,
      composite: PHASES.types,
      domain: PHASES.types,
      range: PHASES.types,
      collation: PHASES.collations,
      sequence: PHASES.sequences,
      function: PHASES.functions,
      operator: PHASES.operators,
      cast: PHASES.casts,
      aggregate: PHASES.aggregates,
      table: PHASES.tables,
      ownership: PHASES.sequenceOwnership,
      primaryKey: PHASES.constraints,
      foreignKey: PHASES.foreignKeys,
      index: PHASES.indexes,
      view: PHASES.views,
      materializedView: PHASES.views,
      trigger: PHASES.triggers,
      rowLevelSecurity: PHASES.rowLevelSecurity,
      policy: PHASES.rowLevelSecurity,
      rule: PHASES.rulesAndStatistics,
      statistics: PHASES.rulesAndStatistics,
      comment: PHASES.comments,
    });
    expect(steps.map(({ phase }) => phase)).toStrictEqual(
      steps.map(({ phase }) => phase).toSorted((a, b) => a - b)
    );
    expect(steps).toHaveLength(objects.length + 5);
    expect(steps).toContainEqual({
      step: 'sequenceOwnership',
      phase: PHASES.sequenceOwnership,
      object: sequence,
    });
    expect(steps).toContainEqual({
      step: 'rowLevelSecurity',
      phase: PHASES.rowLevelSecurity,
      object: table,
    });
    expect(steps).toContainEqual({
      step: 'comment',
      phase: PHASES.comments,
      object: { on: 'object', object: view, text: 'Open' },
    });
  });

  it('breaks the cycle of two tables that reference each other with the constraint phases', () => {
    const a = makeTable('public', 'a');
    const b = makeTable('public', 'b');
    const aKey = makeConstraint(a, 'a_pkey', 'primaryKey', 'PRIMARY KEY (id)');
    const bKey = makeConstraint(b, 'b_pkey', 'primaryKey', 'PRIMARY KEY (id)');
    const aToB = makeConstraint(
      a,
      'a_b_fkey',
      'foreignKey',
      'FOREIGN KEY (b_id) REFERENCES public.b(id)',
      { references: { schema: 'public', name: 'b' } }
    );
    const bToA = makeConstraint(
      b,
      'b_a_fkey',
      'foreignKey',
      'FOREIGN KEY (a_id) REFERENCES public.a(id)',
      { references: { schema: 'public', name: 'a' } }
    );
    const model = modelOf(
      [bToA, aToB, bKey, aKey, b, a],
      [
        dependsOn(aKey, a),
        dependsOn(bKey, b),
        dependsOn(aToB, a),
        dependsOn(aToB, b),
        dependsOn(aToB, bKey),
        dependsOn(bToA, b),
        dependsOn(bToA, a),
        dependsOn(bToA, aKey),
      ]
    );

    expect(labels(model)).toStrictEqual([
      'prologue',
      'create table public.a',
      'create table public.b',
      'create constraint public.a_pkey@public.a',
      'create constraint public.b_pkey@public.b',
      'create constraint public.a_b_fkey@public.a',
      'create constraint public.b_a_fkey@public.b',
      'epilogue',
    ]);
  });

  it('creates a self-referencing table before its keys', () => {
    const table = makeTable('public', 'categories');
    const key = makeConstraint(
      table,
      'categories_pkey',
      'primaryKey',
      'PRIMARY KEY (id)'
    );
    const parent = makeConstraint(
      table,
      'categories_parent_fkey',
      'foreignKey',
      'FOREIGN KEY (parent_id) REFERENCES public.categories(id)',
      { references: { schema: 'public', name: 'categories' } }
    );
    const model = modelOf(
      [parent, key, table],
      [dependsOn(key, table), dependsOn(parent, table), dependsOn(parent, key)]
    );

    expect(labels(model)).toStrictEqual([
      'prologue',
      'create table public.categories',
      'create constraint public.categories_pkey@public.categories',
      'create constraint public.categories_parent_fkey@public.categories',
      'epilogue',
    ]);
  });

  it('creates a view before a function that returns it, whatever their phases', () => {
    const orders = makeTable('public', 'orders');
    const view = makeView('public', 'open_orders', ' SELECT 1 AS id');
    const listOpenOrders = makeFunction('public', 'list_open_orders', {
      returns: 'SETOF public.open_orders',
      returnsSet: true,
      rows: 1000,
    });
    const helper = makeFunction('public', 'a_helper');
    const index = makeIndex(orders, 'orders_idx');
    const model = modelOf(
      [listOpenOrders, helper, view, index, orders],
      [
        dependsOn(view, orders),
        dependsOn(listOpenOrders, view),
        dependsOn(index, orders),
      ]
    );

    expect(labels(model)).toStrictEqual([
      'prologue',
      'create function public.a_helper()',
      'create table public.orders',
      'create index public.orders_idx@public.orders',
      'create view public.open_orders',
      'create function public.list_open_orders()',
      'epilogue',
    ]);
  });

  it('creates partitioned tables before their partitions and parents before their children', () => {
    const events = makeTable('public', 'z_events', {
      partitioned: true,
      partitionKey: 'RANGE (at)',
    });
    const partition = makeTable('public', 'a_events_2025', {
      partitionOf: {
        parent: { schema: 'public', name: 'z_events' },
        bound: "FOR VALUES FROM ('2025-01-01') TO ('2026-01-01')",
      },
    });
    const vehicles = makeTable('public', 'y_vehicles');
    const trucks = makeTable('public', 'b_trucks', {
      inherits: [{ schema: 'public', name: 'y_vehicles' }],
    });
    const model = modelOf(
      [partition, trucks, events, vehicles],
      [dependsOn(partition, events), dependsOn(trucks, vehicles)]
    );

    expect(labels(model)).toStrictEqual([
      'prologue',
      'create table public.y_vehicles',
      'create table public.b_trucks',
      'create table public.z_events',
      'create table public.a_events_2025',
      'epilogue',
    ]);
  });

  it('sets the owner of a sequence after the sequence and the table that owns it', () => {
    const sequence = makeSequence('public', 'order_numbers', {
      ownedBy: { table: { schema: 'public', name: 'orders' }, column: 'no' },
    });
    const orders = makeTable('public', 'orders', {
      columns: [
        makeColumn('no', 'bigint', {
          default: "nextval('public.order_numbers'::regclass)",
        }),
      ],
    });
    const unowned = makeSequence('public', 'z_numbers');
    const model = modelOf(
      [orders, unowned, sequence],
      [dependsOn(orders, sequence)]
    );

    expect(labels(model)).toStrictEqual([
      'prologue',
      'create sequence public.order_numbers',
      'create sequence public.z_numbers',
      'create table public.orders',
      'own public.order_numbers',
      'epilogue',
    ]);
  });

  it('enables row-level security after its table', () => {
    const documents = makeTable('public', 'documents', {
      rowLevelSecurity: true,
      forceRowLevelSecurity: true,
    });
    const forced = makeTable('public', 'forced', {
      forceRowLevelSecurity: true,
    });
    const plain = makeTable('public', 'plain');
    const policy = makePolicy(documents, 'documents_tenant');
    const model = modelOf(
      [policy, plain, forced, documents],
      [dependsOn(policy, documents)]
    );

    expect(labels(model)).toStrictEqual([
      'prologue',
      'create table public.documents',
      'create table public.forced',
      'create table public.plain',
      'rls public.documents',
      'create policy public.documents_tenant@public.documents',
      'rls public.forced',
      'epilogue',
    ]);
  });

  it('sets the comments that are not set with a table last, after their objects', () => {
    const orders = makeTable('public', 'orders', {
      comment: 'Set with the table',
      columns: [makeColumn('id', 'integer', { comment: 'Also' })],
    });
    const view = makeView('public', 'v', ' SELECT 1 AS a, 2 AS b', {
      comment: 'A view',
      columns: [
        { name: 'b', comment: 'Column b' },
        { name: 'a', comment: 'Column a' },
      ],
    });
    const model = modelOf(
      [
        view,
        makeSchema('kitchen', { comment: 'Kitchen things' }),
        makeComposite('public', 'address', [
          { name: 'street', type: 'text', comment: 'Street' },
        ]),
        makeDomain('public', 'amount', 'numeric', {
          checks: [
            {
              name: 'amount_positive',
              expression: '(VALUE > (0)::numeric)',
              validated: true,
              comment: 'Positive',
            },
          ],
        }),
        makeFunction('public', 'f', { comment: 'A function' }),
        makeConstraint(
          orders,
          'orders_pkey',
          'primaryKey',
          'PRIMARY KEY (id)',
          {
            comment: 'The key',
          }
        ),
        makeConstraint(orders, 'orders_code_key', 'unique', 'UNIQUE (code)', {
          indexComment: 'Its index',
        }),
        makeExtension('public', 'pg_trgm'),
        orders,
      ],
      [dependsOn(view, orders)]
    );
    const all = labels(model);
    const firstComment = all.findIndex((step) => step.startsWith('comment'));

    expect(all.slice(firstComment)).toStrictEqual([
      'comment object kitchen.kitchen',
      'comment column public.address.street',
      'comment domainConstraint public.amount.amount_positive',
      'comment object public.f()',
      'comment constraintIndex public.orders_code_key@public.orders',
      'comment object public.orders_pkey@public.orders',
      'comment object public.v',
      'comment column public.v.a',
      'comment column public.v.b',
      'epilogue',
    ]);
    expect(orderObjects(model)).toContainEqual({
      step: 'comment',
      phase: PHASES.comments,
      object: { on: 'column', object: view, column: 'a', text: 'Column a' },
    });
  });

  it('breaks ties by schema, name, table, identity arguments and cast types', () => {
    const tableA = makeTable('public', 'a');
    const tableB = makeTable('public', 'b');
    const onB = makeTrigger(tableB, 'audit');
    const onA = makeTrigger(tableA, 'audit');
    const model = modelOf(
      [
        onB,
        onA,
        tableB,
        makeTable('public', 'alpha'),
        makeTable('public', '_under'),
        tableA,
        makeTable('public', 'Zeta'),
        makeTable('app', 'zeta'),
        makeFunction('public', 'f', { identityArguments: 'x text' }),
        makeFunction('public', 'f', { identityArguments: 'x integer' }),
        makeCast('integer', 'text'),
        makeCast('bigint', 'text'),
        makeCast('bigint', 'integer'),
      ],
      [dependsOn(onA, tableA), dependsOn(onB, tableB)]
    );

    expect(labels(model)).toStrictEqual([
      'prologue',
      'create function public.f(x integer)',
      'create function public.f(x text)',
      'create cast (bigint AS integer)',
      'create cast (bigint AS text)',
      'create cast (integer AS text)',
      'create table app.zeta',
      'create table public.Zeta',
      'create table public._under',
      'create table public.a',
      'create table public.alpha',
      'create table public.b',
      'create trigger public.audit@public.a',
      'create trigger public.audit@public.b',
      'epilogue',
    ]);
  });

  it('gives the same steps for the objects of a model in any order', () => {
    const orders = makeTable('public', 'orders', { rowLevelSecurity: true });
    const lines = makeTable('public', 'order_lines');
    const key = makeConstraint(
      orders,
      'orders_pkey',
      'primaryKey',
      'PRIMARY KEY (id)'
    );
    const fkey = makeConstraint(
      lines,
      'order_lines_order_fkey',
      'foreignKey',
      'FOREIGN KEY (order_id) REFERENCES public.orders(id)'
    );
    const sequence = makeSequence('public', 'order_numbers', {
      ownedBy: { table: { schema: 'public', name: 'orders' }, column: 'id' },
      comment: 'Numbers',
    });
    const view = makeView('public', 'open_orders', ' SELECT 1');
    const objects: ModelObject[] = [
      orders,
      lines,
      key,
      fkey,
      sequence,
      view,
      makeTrigger(orders, 'audit'),
      makeTrigger(lines, 'audit'),
      makeFunction('public', 'f', { identityArguments: 'x text' }),
      makeFunction('public', 'f', { identityArguments: 'x integer' }),
      makeIndex(orders, 'orders_idx'),
      makePolicy(orders, 'orders_policy'),
    ];
    const dependencies = [
      dependsOn(key, orders),
      dependsOn(fkey, lines),
      dependsOn(fkey, orders),
      dependsOn(fkey, key),
      dependsOn(orders, sequence),
      dependsOn(view, orders),
    ];

    expect(
      orderObjects(modelOf(objects.toReversed(), dependencies.toReversed()))
    ).toStrictEqual(orderObjects(modelOf(objects, dependencies)));
  });

  it('rejects a dependency cycle that the phases cannot break, naming its objects', () => {
    const view = makeView('public', 'loop_view', ' SELECT public.loop_fn()');
    const fn = makeFunction('public', 'loop_fn', { hasSqlBody: true });
    const bystander = makeTable('public', 'bystander');
    const model = modelOf(
      [view, fn, bystander],
      [dependsOn(view, fn), dependsOn(fn, view)]
    );

    const error = thrownBy(() => orderObjects(model));

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'UNSUPPORTED_OBJECTS' });
    expect(String(error)).toContain('loop_view');
    expect(String(error)).toContain('loop_fn');
    expect(String(error)).not.toContain('bystander');
  });
});
