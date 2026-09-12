import { describe, expect, it } from 'vitest';
import { BaselineError } from '../../src/baseline/errors';
import { generateMigration } from '../../src/codegen';
import type { GenerateOptions, OutputLanguage } from '../../src/codegen/types';
import type {
  ModelObject,
  SchemaModel,
  UnsupportedObject,
} from '../../src/introspect/types';
import {
  defaultSequenceOptions,
  dependsOn,
  makeAggregate,
  makeColumn,
  makeConstraint,
  makeEnum,
  makeFunction,
  makeIndex,
  makeMaterializedView,
  makePolicy,
  makeSchema,
  makeSequence,
  makeTable,
  makeView,
  modelOf,
  qualified,
} from '../introspect/objects';
import { generatedModel } from './models';
import { loadMigration, runUp } from './run';
import { canonicalStatements, canonicalSteps } from './sql';

const FAKE_COMMAND = 'node-pg-migrate up 1700000000000_baseline --fake';

const OPTIONS: GenerateOptions = {
  language: 'ts',
  defaultSchema: 'public',
  migrationName: '1700000000000_baseline',
  fakeCommand: FAKE_COMMAND,
  source: { serverVersion: '18.6' },
};

const LANGUAGES: ReadonlyArray<OutputLanguage> = ['ts', 'js'];

const PROLOGUE = `SELECT pg_catalog.set_config('node_pg_migrate.check_function_bodies', pg_catalog.current_setting('check_function_bodies'), true);
  SET LOCAL check_function_bodies = false;`;
const EPILOGUE =
  "SELECT pg_catalog.set_config('check_function_bodies', pg_catalog.current_setting('node_pg_migrate.check_function_bodies'), true);";

/**
 * A small schema with objects of most kinds, four of which need a fallback:
 * an aggregate, a partition, a restrictive policy and a comment on a view.
 */
function kitchenModel(): SchemaModel {
  const kitchen = makeSchema('kitchen');
  const mood = makeEnum('kitchen', 'mood', ['sad', 'ok']);
  const orders = makeTable('kitchen', 'orders', {
    rowLevelSecurity: true,
    comment: 'Orders',
    columns: [
      makeColumn('id', 'bigint', {
        notNull: true,
        identity: {
          generation: 'ALWAYS',
          sequence: { schema: 'kitchen', name: 'orders_id_seq' },
          options: defaultSequenceOptions('bigint'),
        },
      }),
      makeColumn('status', 'kitchen.mood', {
        notNull: true,
        default: "'ok'::kitchen.mood",
      }),
      makeColumn('owner', 'name', { notNull: true, default: 'CURRENT_USER' }),
      makeColumn('placed_at', 'timestamp with time zone', {
        notNull: true,
        default: 'now()',
      }),
    ],
  });
  const usersSequence = makeSequence('public', 'users_id_seq', {
    ...defaultSequenceOptions('integer'),
    ownedBy: { table: { schema: 'public', name: 'users' }, column: 'id' },
  });
  const users = makeTable('public', 'users', {
    columns: [
      makeColumn('id', 'integer', {
        notNull: true,
        default: "nextval('public.users_id_seq'::regclass)",
        ownedSequence: {
          name: { schema: 'public', name: 'users_id_seq' },
          options: defaultSequenceOptions('integer'),
          unlogged: false,
        },
      }),
      makeColumn('email', 'text'),
    ],
  });
  const ordersKey = makeConstraint(
    orders,
    'orders_pkey',
    'primaryKey',
    'PRIMARY KEY (id)'
  );
  const usersKey = makeConstraint(
    users,
    'users_pkey',
    'primaryKey',
    'PRIMARY KEY (id)'
  );
  const placedAt = makeIndex(orders, 'orders_placed_idx', {
    keys: [{ column: 'placed_at', descending: false, nullsFirst: false }],
  });
  const openOrders = makeView(
    'kitchen',
    'open_orders',
    " SELECT id\n   FROM kitchen.orders\n  WHERE (status <> 'sad'::kitchen.mood)",
    { comment: 'Open orders' }
  );
  const totals = makeMaterializedView(
    'kitchen',
    'totals',
    ' SELECT count(*) AS n\n   FROM kitchen.orders'
  );
  const pipeAgg = makeAggregate('kitchen', 'pipe_agg', {
    stateFunction: 'pg_catalog.textcat',
  });
  const measurements = makeTable('kitchen', 'measurements', {
    partitioned: true,
    partitionKey: 'RANGE (at)',
    columns: [makeColumn('at', 'date')],
  });
  const measurements2025 = makeTable('kitchen', 'measurements_2025', {
    partitionOf: {
      parent: qualified(measurements),
      bound: "FOR VALUES FROM ('2025-01-01') TO ('2026-01-01')",
    },
    columns: [makeColumn('at', 'date', { local: false, inheritCount: 1 })],
  });
  const ownerOnly = makePolicy(orders, 'orders_owner_only', {
    command: 'DELETE',
    permissive: false,
    roles: ['app_user'],
    using: '(owner = CURRENT_USER)',
  });
  const objects: ModelObject[] = [
    kitchen,
    mood,
    orders,
    usersSequence,
    users,
    ordersKey,
    usersKey,
    placedAt,
    openOrders,
    totals,
    pipeAgg,
    measurements,
    measurements2025,
    ownerOnly,
  ];

  return modelOf(objects, [
    dependsOn(mood, kitchen),
    dependsOn(orders, kitchen),
    dependsOn(orders, mood),
    dependsOn(users, usersSequence),
    dependsOn(ordersKey, orders),
    dependsOn(usersKey, users),
    dependsOn(placedAt, orders),
    dependsOn(openOrders, orders),
    dependsOn(openOrders, mood),
    dependsOn(totals, orders),
    dependsOn(pipeAgg, kitchen),
    dependsOn(measurements, kitchen),
    dependsOn(measurements2025, measurements),
    dependsOn(ownerOnly, orders),
  ]);
}

const FALLBACKS = [
  {
    kind: 'aggregate',
    identity: 'kitchen.pipe_agg(text)',
    reason: 'aggregate',
  },
  {
    kind: 'table',
    identity: 'kitchen.measurements_2025',
    reason: 'partition',
  },
  {
    kind: 'policy',
    identity: 'orders_owner_only on kitchen.orders',
    reason: 'restrictive policy',
  },
  {
    kind: 'comment',
    identity: 'kitchen.open_orders',
    reason: 'comment on view',
  },
];

function reversed(model: SchemaModel): SchemaModel {
  return Object.fromEntries(
    Object.entries(model).map(
      ([key, value]: [string, ReadonlyArray<unknown>]) => [
        key,
        value.toReversed(),
      ]
    )
  ) as unknown as SchemaModel;
}

function thrownBy(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }

  return undefined;
}

async function upSql(
  content: string,
  language: OutputLanguage
): Promise<string[]> {
  return canonicalSteps(await runUp(await loadMigration(content, language)));
}

describe('generateMigration', () => {
  it.each(LANGUAGES)(
    'generates a %s migration that the runner loads, between the check_function_bodies prologue and epilogue',
    async (language) => {
      const { content } = generateMigration(kitchenModel(), {
        ...OPTIONS,
        language,
      });
      const actions = await loadMigration(content, language);
      const sql = canonicalSteps(await runUp(actions));

      expect(actions.down).toBe(false);
      expect(sql.slice(0, 2)).toStrictEqual(canonicalStatements(PROLOGUE));
      expect(sql.slice(-1)).toStrictEqual(canonicalStatements(EPILOGUE));
    }
  );

  it('creates the objects in the order of their dependencies and phases', async () => {
    const sql = await upSql(
      generateMigration(kitchenModel(), OPTIONS).content,
      'ts'
    );
    const expected = [
      'create schema if not exists kitchen',
      'create type kitchen . mood as enum',
      'create aggregate kitchen . pipe_agg',
      'create table kitchen . measurements (',
      'create table kitchen . measurements_2025 partition of',
      'create table kitchen . orders (',
      'create table users (',
      'alter table kitchen . orders add constraint orders_pkey',
      'create index orders_placed_idx',
      'create view kitchen . open_orders',
      'create materialized view kitchen . totals',
      'alter table kitchen . orders enable row level security',
      'comment on view kitchen . open_orders',
    ];
    const positions = expected.map((prefix) =>
      sql.findIndex((statement) => statement.startsWith(prefix))
    );

    expect(positions).not.toContain(-1);
    expect(positions).toStrictEqual(positions.toSorted((a, b) => a - b));
  });

  it('creates a serial column with its table, without its sequence', async () => {
    const sql = await upSql(
      generateMigration(kitchenModel(), OPTIONS).content,
      'ts'
    );

    expect(sql).toContain('create table users ( id serial , email text )');
    expect(
      sql.filter((statement) => statement.startsWith('create sequence'))
    ).toStrictEqual([]);
    expect(
      sql.filter((statement) => statement.includes('owned by'))
    ).toStrictEqual([]);
  });

  it('lists the fallbacks in the order of the migration, each under its comment', () => {
    const { content, fallbacks } = generateMigration(kitchenModel(), OPTIONS);

    expect(fallbacks).toStrictEqual(FALLBACKS);
    expect(
      content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('// fallback:'))
    ).toStrictEqual(FALLBACKS.map(({ reason }) => `// fallback: ${reason}`));
  });

  it('counts what the migration creates like a dump', () => {
    const { stats } = generateMigration(kitchenModel(), OPTIONS);

    expect(stats).toStrictEqual({
      tables: 4,
      indexes: 1,
      indexBackedConstraints: 2,
      sequences: 2,
      views: 1,
      materializedViews: 1,
    });
  });

  it('says where the schema comes from and how to record the migration', () => {
    const { content } = generateMigration(kitchenModel(), OPTIONS);

    expect(content).toContain(FAKE_COMMAND);
    expect(content).toContain('18.6');
    expect(content).toMatch(/experimental/i);
  });

  it('writes the same file for the same model, whatever the order of its arrays', () => {
    const model = kitchenModel();
    const first = generateMigration(model, OPTIONS);
    const second = generateMigration(reversed(model), OPTIONS);

    expect(second.content).toBe(first.content);
    expect(second.fallbacks).toStrictEqual(first.fallbacks);
    expect(first.content.endsWith('\n')).toBe(true);
    expect(first.content.endsWith('\n\n')).toBe(false);
  });

  it.each([
    [1, 0, '896'],
    [1, 1, '448'],
  ])(
    'sizes the max_locks_per_transaction note for %i connection(s) and %i prepared transaction(s)',
    (maxConnections, maxPreparedTransactions, required) => {
      const result = generateMigration(generatedModel(100), {
        ...OPTIONS,
        maxConnections,
        maxPreparedTransactions,
      });

      expect(result.stats).toStrictEqual({
        tables: 100,
        indexes: 100,
        indexBackedConstraints: 200,
        sequences: 100,
        views: 10,
        materializedViews: 0,
      });
      expect(result.content).toContain('max_locks_per_transaction');
      expect(result.content).toContain(required);
    }
  );

  it('leaves out the max_locks_per_transaction note when the default is enough', () => {
    const { content } = generateMigration(generatedModel(100), OPTIONS);

    expect(content).not.toContain('max_locks_per_transaction');
  });

  it('fails in strict mode, listing every fallback and why', () => {
    const error = thrownBy(() =>
      generateMigration(kitchenModel(), { ...OPTIONS, strict: true })
    );

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'UNSUPPORTED_OBJECTS' });
    for (const { identity, reason } of FALLBACKS) {
      expect(String(error)).toContain(identity);
      expect(String(error)).toContain(reason);
    }
  });

  it('generates a strict migration without fallbacks', async () => {
    const model = generatedModel(20);
    const result = generateMigration(model, { ...OPTIONS, strict: true });

    expect(result.fallbacks).toStrictEqual([]);
    expect(result.content).not.toContain('// fallback:');
    await expect(upSql(result.content, 'ts')).resolves.toContain(
      'alter table t_00020 add constraint t_00020_parent_id_fkey foreign key ( parent_id ) references public . t_00019 ( id )'
    );
  });

  it('refuses objects that no migration can represent, suggesting --format sql', () => {
    const unsupported: UnsupportedObject[] = [
      { kind: 'event trigger', identity: 'audit_ddl' },
      { kind: 'text search configuration', identity: 'kitchen.english_nostop' },
    ];
    const error = thrownBy(() =>
      generateMigration({ ...kitchenModel(), unsupported }, OPTIONS)
    );

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'UNSUPPORTED_OBJECTS' });
    expect(String(error)).toContain('event trigger');
    expect(String(error)).toContain('audit_ddl');
    expect(String(error)).toContain('text search configuration');
    expect(String(error)).toContain('kitchen.english_nostop');
    expect(String(error)).toContain('--format sql');
  });

  it('refuses a dependency cycle', () => {
    const view = makeView(
      'public',
      'loop_view',
      ' SELECT public.loop_fn() AS n'
    );
    const fn = makeFunction('public', 'loop_fn', { hasSqlBody: true });
    const error = thrownBy(() =>
      generateMigration(
        modelOf([view, fn], [dependsOn(view, fn), dependsOn(fn, view)]),
        OPTIONS
      )
    );

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'UNSUPPORTED_OBJECTS' });
    expect(String(error)).toContain('loop_view');
    expect(String(error)).toContain('loop_fn');
  });

  it.each(LANGUAGES)(
    'generates only the prologue and epilogue for an empty schema in %s',
    async (language) => {
      const { content, fallbacks, stats } = generateMigration(modelOf([]), {
        ...OPTIONS,
        language,
      });

      expect(fallbacks).toStrictEqual([]);
      expect(stats).toStrictEqual({
        tables: 0,
        indexes: 0,
        indexBackedConstraints: 0,
        sequences: 0,
        views: 0,
        materializedViews: 0,
      });
      await expect(upSql(content, language)).resolves.toStrictEqual([
        ...canonicalStatements(PROLOGUE),
        ...canonicalStatements(EPILOGUE),
      ]);
    }
  );
});
