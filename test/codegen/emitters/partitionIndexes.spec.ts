import { describe, expect, it } from 'vitest';
import { emitConstraint } from '../../../src/codegen/emitters/constraints';
import { emitIndex } from '../../../src/codegen/emitters/indexes';
import {
  namedPartitionIndexes,
  partitionIndexName,
} from '../../../src/codegen/emitters/shared';
import type { PartitionIndex } from '../../../src/introspect/types';
import { makeConstraint, makeIndex } from '../../introspect/objects';
import { expectCode, expectFallback, expectSql } from '../expectations';
import { emitAndRun } from '../run';

// Creating the index of a partitioned table, or adding its primary key,
// unique or exclusion constraint, creates the ones of its partitions with
// names PostgreSQL chooses, or attaches the partitions' matching ones: those
// with another name are created first.

const MEASUREMENTS = { schema: 'kitchen', name: 'measurements' };

/**
 * The index of a partition of `kitchen.measurements`.
 */
function partitionIndex(
  table: string,
  name: string,
  fields: Partial<PartitionIndex> = {}
): PartitionIndex {
  return {
    table: { schema: 'kitchen', name: table },
    name,
    columns: ['value'],
    definition: `CREATE INDEX ${name} ON kitchen.${table} USING btree (value)`,
    level: 1,
    ...fields,
  };
}

describe('partitionIndexName', () => {
  it.each([
    { label: 'idx', columns: ['value'], expected: 'm_2025_value_idx' },
    {
      label: 'idx',
      columns: ['lower', 'upper', 'expr'],
      expected: 'm_2025_lower_upper_expr_idx',
    },
    { label: 'key', columns: ['b', 'at'], expected: 'm_2025_b_at_key' },
    { label: 'excl', columns: ['r', 'at'], expected: 'm_2025_r_at_excl' },
    { label: 'pkey', columns: ['a', 'at'], expected: 'm_2025_pkey' },
  ] as const)(
    'names a $label index on $columns like PostgreSQL',
    ({ label, columns, expected }) => {
      expect(
        partitionIndexName(partitionIndex('m_2025', 'x', { columns }), label)
      ).toBe(expected);
    }
  );

  it('shortens a long name like PostgreSQL', () => {
    const name = partitionIndexName(
      partitionIndex('a'.repeat(40), 'x', { columns: ['b'.repeat(40)] }),
      'idx'
    );

    expect(name).toBe(`${'a'.repeat(29)}_${'b'.repeat(29)}_idx`);
    expect(name).toHaveLength(63);
  });
});

describe('namedPartitionIndexes', () => {
  it('keeps the indexes that PostgreSQL would name differently', () => {
    const own = partitionIndex('m_2026', 'm_2026_readings');

    expect(
      namedPartitionIndexes(
        [partitionIndex('m_2025', 'm_2025_value_idx'), own],
        'idx'
      )
    ).toStrictEqual([own]);
    expect(namedPartitionIndexes(undefined, 'idx')).toStrictEqual([]);
  });
});

describe('emitIndex', () => {
  it('creates the indexes of partitions with a name of their own first', () => {
    const result = emitAndRun(
      emitIndex,
      makeIndex(MEASUREMENTS, 'measurements_value_idx', {
        keys: [{ column: 'value', descending: false, nullsFirst: false }],
        partitionIndexes: [
          partitionIndex('measurements_2026_eu', 'eu_readings', {
            level: 2,
          }),
          partitionIndex('measurements_2025', 'measurements_2025_value_idx'),
          partitionIndex('measurements_2026', 'readings_2026', {
            definition:
              'CREATE INDEX readings_2026 ON ONLY kitchen.measurements_2026 USING btree (value)',
          }),
        ],
      })
    );

    expectFallback(result, 'partition index name');
    expect(result.calls).toStrictEqual(['sql', 'sql', 'createIndex']);
    expectSql(
      result,
      [
        'CREATE INDEX eu_readings ON kitchen.measurements_2026_eu USING btree (value);',
        'CREATE INDEX readings_2026 ON kitchen.measurements_2026 USING btree (value);',
        'CREATE INDEX "measurements_value_idx" ON "kitchen"."measurements" ("value");',
      ].join('\n')
    );
  });

  it('gives the reasons of a fallback index in order', () => {
    const result = emitAndRun(
      emitIndex,
      makeIndex(MEASUREMENTS, 'measurements_value_idx', {
        method: 'brin',
        definition:
          'CREATE INDEX measurements_value_idx ON ONLY kitchen.measurements USING brin (value)',
        clustered: true,
        partitionIndexes: [partitionIndex('measurements_2025', 'readings')],
      })
    );

    expectFallback(
      result,
      'index method brin',
      'partition index name',
      'CLUSTER ON'
    );
    expectSql(
      result,
      [
        'CREATE INDEX readings ON kitchen.measurements_2025 USING btree (value);',
        'CREATE INDEX measurements_value_idx ON kitchen.measurements USING brin (value);',
        'ALTER TABLE "kitchen"."measurements" CLUSTER ON "measurements_value_idx";',
      ].join('\n')
    );
  });

  it('leaves the indexes that PostgreSQL names itself to it', () => {
    const result = emitAndRun(
      emitIndex,
      makeIndex(MEASUREMENTS, 'measurements_value_idx', {
        keys: [{ column: 'value', descending: false, nullsFirst: false }],
        partitionIndexes: [
          partitionIndex('measurements_2025', 'measurements_2025_value_idx'),
        ],
      })
    );

    expectCode(result);
    expect(result.calls).toStrictEqual(['createIndex']);
  });
});

describe('emitConstraint', () => {
  it('adds the constraints of partitions with a name of their own first', () => {
    const result = emitAndRun(
      emitConstraint,
      makeConstraint(
        MEASUREMENTS,
        'measurements_pkey',
        'primaryKey',
        'PRIMARY KEY (sensor_id, measured_at)',
        {
          partitionIndexes: [
            partitionIndex('measurements_2025', 'measurements_2025_pkey'),
            partitionIndex('measurements_2026', 'readings_2026_pk', {
              constraintDefinition:
                'PRIMARY KEY (sensor_id, measured_at) DEFERRABLE',
            }),
            partitionIndex('measurements_2027', 'readings_2027_pk'),
          ],
        }
      )
    );

    expectCode(result);
    expect(result.calls).toStrictEqual([
      'addConstraint',
      'addConstraint',
      'addConstraint',
    ]);
    expectSql(
      result,
      [
        'ALTER TABLE "kitchen"."measurements_2026" ADD CONSTRAINT "readings_2026_pk" PRIMARY KEY (sensor_id, measured_at) DEFERRABLE;',
        'ALTER TABLE "kitchen"."measurements_2027" ADD CONSTRAINT "readings_2027_pk" PRIMARY KEY (sensor_id, measured_at);',
        'ALTER TABLE "kitchen"."measurements" ADD CONSTRAINT "measurements_pkey" PRIMARY KEY (sensor_id, measured_at);',
      ].join('\n')
    );
  });

  it.each([
    {
      type: 'unique',
      definition: 'UNIQUE (label, at)',
      generated: 'measurements_2025_label_at_key',
    },
    {
      type: 'exclusion',
      definition: 'EXCLUDE USING gist (label WITH =, at WITH =)',
      generated: 'measurements_2025_label_at_excl',
    },
  ] as const)(
    'names the indexes of a $type constraint like PostgreSQL',
    ({ type, definition, generated }) => {
      const result = emitAndRun(
        emitConstraint,
        makeConstraint(MEASUREMENTS, 'measurements_key', type, definition, {
          partitionIndexes: [
            partitionIndex('measurements_2025', generated, {
              columns: ['label', 'at'],
            }),
          ],
        })
      );

      expect(result.calls).toStrictEqual(['addConstraint']);
    }
  );

  it('adds the constraints of partitions with raw SQL when the definition has a line break', () => {
    const definition =
      "EXCLUDE USING gist (label WITH =) WHERE ((label <> 'a\nb'::text))";
    const result = emitAndRun(
      emitConstraint,
      makeConstraint(
        MEASUREMENTS,
        'measurements_label_excl',
        'exclusion',
        definition,
        { partitionIndexes: [partitionIndex('measurements_2025', 'labels')] }
      )
    );

    expectFallback(result, 'line break');
    expect(result.calls).toStrictEqual(['sql', 'sql']);
    expect(result.steps.join('\n')).toContain(
      'ALTER TABLE "kitchen"."measurements_2025" ADD CONSTRAINT "labels" EXCLUDE'
    );
  });

  it('leaves the partitions alone for a CHECK constraint', () => {
    const result = emitAndRun(
      emitConstraint,
      makeConstraint(
        MEASUREMENTS,
        'measurements_value_check',
        'check',
        'CHECK ((value > (0)::double precision))',
        { partitionIndexes: [partitionIndex('measurements_2025', 'labels')] }
      )
    );

    expect(result.calls).toStrictEqual(['addConstraint']);
  });
});
