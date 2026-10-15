import { describe, expect, it, vi } from 'vitest';
import type { PartitionBound } from '../../../src';
import { MigrationBuilder, PgLiteral } from '../../../src';
import { createPartition } from '../../../src/operations/tables';
import { options1, options2 } from '../../presetMigrationOptions';

describe('createPartition', () => {
  const create = createPartition(options1);

  it.each<[PartitionBound, string]>([
    [
      {
        strategy: 'RANGE',
        from: [0, new PgLiteral('MINVALUE')],
        to: [10, new PgLiteral('MAXVALUE')],
      },
      'FOR VALUES FROM (0, MINVALUE) TO (10, MAXVALUE)',
    ],
    [
      { strategy: 'LIST', values: [false, true, null, 0] },
      'FOR VALUES IN (false, true, NULL, 0)',
    ],
    [
      {
        strategy: 'LIST',
        values: ["O'Reilly", '$pga$; DROP TABLE events; --', 'MINVALUE'],
      },
      "FOR VALUES IN ($pga$O'Reilly$pga$, $pgb$$pga$; DROP TABLE events; --$pgb$, $pga$MINVALUE$pga$)",
    ],
    [
      { strategy: 'LIST', values: [[1, 2], new PgLiteral("lower('READY')")] },
      "FOR VALUES IN (ARRAY[1,2], lower('READY'))",
    ],
    [
      { strategy: 'HASH', modulus: 4, remainder: 0 },
      'FOR VALUES WITH (MODULUS 4, REMAINDER 0)',
    ],
    [
      { strategy: 'HASH', modulus: 4, remainder: 3 },
      'FOR VALUES WITH (MODULUS 4, REMAINDER 3)',
    ],
    [
      { strategy: 'HASH', modulus: 2_147_483_647, remainder: 2_147_483_646 },
      'FOR VALUES WITH (MODULUS 2147483647, REMAINDER 2147483646)',
    ],
    [{ strategy: 'DEFAULT' }, 'DEFAULT'],
  ])('renders bounds %j', (bound, sql) => {
    expect(create('child', 'parent', bound)).toBe(
      `CREATE TABLE "child" PARTITION OF "parent" ${sql};`
    );
  });

  it('quotes qualified names and supports subpartitioning and comments', () => {
    expect(
      create(
        { schema: 'child.schema', name: 'child"表' },
        { schema: 'parent.schema', name: 'parent"表' },
        { strategy: 'DEFAULT' },
        {
          ifNotExists: true,
          partition: { strategy: 'HASH', columns: 'some"key' },
          comment: "child's comment",
        }
      )
    ).toBe(
      'CREATE TABLE IF NOT EXISTS "child.schema"."child""表" PARTITION OF "parent.schema"."parent""表" DEFAULT PARTITION BY HASH ("some""key");\nCOMMENT ON TABLE "child.schema"."child""表" IS $pga$child\'s comment$pga$;'
    );
  });

  it('normalizes names consistently when reversing', () => {
    const operation = createPartition(options2);
    const child = { schema: 'mySchema', name: 'myChild' };
    expect(operation(child, 'myParent', { strategy: 'DEFAULT' })).toBe(
      'CREATE TABLE "my_schema"."my_child" PARTITION OF "my_parent" DEFAULT;'
    );
    expect(operation.reverse(child, 'myParent', { strategy: 'DEFAULT' })).toBe(
      'ALTER TABLE "my_parent" DETACH PARTITION "my_schema"."my_child";\nDROP TABLE "my_schema"."my_child";'
    );
    expect(
      operation.reverse(
        child,
        'myParent',
        { strategy: 'DEFAULT' },
        { ifExists: true, cascade: true }
      )
    ).toBe('DROP TABLE IF EXISTS "my_schema"."my_child" CASCADE;');
  });

  it('preserves explicit SQL identifiers', () => {
    expect(
      create(new PgLiteral('child'), new PgLiteral('parent'), {
        strategy: 'DEFAULT',
      })
    ).toBe('CREATE TABLE child PARTITION OF parent DEFAULT;');
    expect(
      create.reverse(new PgLiteral('child'), new PgLiteral('parent'), {
        strategy: 'DEFAULT',
      })
    ).toBe('ALTER TABLE parent DETACH PARTITION child;\nDROP TABLE child;');
  });

  it.each([{}, { ifExists: false }, { cascade: true }])(
    'detaches before dropping with reversal options %j',
    (options) => {
      expect(
        create.reverse(
          { schema: 'child.schema', name: 'child"表' },
          { schema: 'parent.schema', name: 'parent"表' },
          { strategy: 'DEFAULT' },
          options
        )
      ).toBe(
        'ALTER TABLE "parent.schema"."parent""表" DETACH PARTITION "child.schema"."child""表";\n' +
          `DROP TABLE "child.schema"."child""表"${options.cascade ? ' CASCADE' : ''};`
      );
    }
  );

  it('skips detaching when ifExists allows a missing child or parent', () => {
    expect(
      create.reverse(
        'child',
        'parent',
        { strategy: 'DEFAULT' },
        { ifExists: true }
      )
    ).toBe('DROP TABLE IF EXISTS "child";');
  });

  it.each([
    [{ temporary: true }, ' TEMPORARY'],
    [{ unlogged: true }, ' UNLOGGED'],
  ] as const)('supports persistence options %j', (options, persistence) => {
    expect(create('child', 'parent', { strategy: 'DEFAULT' }, options)).toBe(
      `CREATE${persistence} TABLE "child" PARTITION OF "parent" DEFAULT;`
    );
  });

  it('rejects conflicting persistence options', () => {
    expect(() =>
      create(
        'child',
        'parent',
        { strategy: 'DEFAULT' },
        { temporary: true, unlogged: true }
      )
    ).toThrow('TEMPORARY and UNLOGGED cannot be used together.');
  });

  it.each<[PartitionBound, string]>([
    [{ strategy: 'RANGE', from: [], to: [] }, 'RANGE partition bounds'],
    [{ strategy: 'RANGE', from: [0], to: [1, 2] }, 'RANGE partition bounds'],
    [{ strategy: 'LIST', values: [] }, 'LIST partition bounds'],
    ...[
      0,
      -1,
      1.5,
      Infinity,
      NaN,
      2_147_483_648,
      4_294_967_296,
      Number.MAX_SAFE_INTEGER + 1,
    ].map((modulus): [PartitionBound, string] => [
      { strategy: 'HASH', modulus, remainder: 0 },
      'HASH partition bounds',
    ]),
    ...[
      { strategy: 'RANGE', from: 0, to: 1 },
      { strategy: 'RANGE', from: '0', to: '1' },
      { strategy: 'RANGE', from: undefined, to: [1] },
      { strategy: 'RANGE', from: [0], to: null },
    ].map((bound): [PartitionBound, string] => [
      bound as unknown as PartitionBound,
      'RANGE partition bounds',
    ]),
    ...[0, 'ready', null, undefined].map((values): [PartitionBound, string] => [
      { strategy: 'LIST', values } as unknown as PartitionBound,
      'LIST partition bounds',
    ]),
    ...[-1, 2, 0.5, Infinity, NaN].map(
      (remainder): [PartitionBound, string] => [
        { strategy: 'HASH', modulus: 2, remainder },
        'HASH partition bounds',
      ]
    ),
    [
      { strategy: 'INVALID' } as unknown as PartitionBound,
      'Unsupported partition bound strategy',
    ],
  ])('rejects invalid bounds %j without queueing SQL', (bound, message) => {
    const pgm = new MigrationBuilder(
      { query: vi.fn(), select: vi.fn() },
      undefined,
      false,
      console,
      false
    );
    pgm.sql('SELECT 1;');
    const before = pgm.getSql();
    expect(() => {
      pgm.createPartition('child', 'parent', bound);
    }).toThrow(message);
    expect(pgm.getSql()).toBe(before);
  });

  it('queues a child partition and keeps detach before drop in one reverse step', () => {
    const pgm = new MigrationBuilder(
      { query: vi.fn(), select: vi.fn() },
      undefined,
      false,
      console,
      false
    );
    pgm.createPartition('events_2026', 'events', {
      strategy: 'RANGE',
      from: ['2026-01-01'],
      to: ['2027-01-01'],
    });
    expect(pgm.getSql()).toBe(
      'CREATE TABLE "events_2026" PARTITION OF "events" FOR VALUES FROM ($pga$2026-01-01$pga$) TO ($pga$2027-01-01$pga$);\n'
    );
    pgm.enableReverseMode();
    pgm.createPartition('events_2026', 'events', {
      strategy: 'RANGE',
      from: ['2026-01-01'],
      to: ['2027-01-01'],
    });
    expect(pgm.getSqlSteps()).toContain(
      'ALTER TABLE "events" DETACH PARTITION "events_2026";\nDROP TABLE "events_2026";'
    );
  });
});
