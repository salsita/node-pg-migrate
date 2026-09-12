import { describe, expect, it } from 'vitest';
import { rowsToModel } from '../../src/introspect/core/model';
import {
  aggregateRow,
  columnRow,
  constraintRow,
  dependencyRow,
  emptyRows,
  FACTS,
  indexRow,
  sequenceRow,
  statisticsRow,
  tableRow,
} from './rows';

// Rows the catalogs rarely produce, or only in a race with DDL: the model
// must still be built from them.

describe('rowsToModel on unusual rows', () => {
  it('leaves out the moving state space of an aggregate when it is 0', () => {
    const model = rowsToModel(
      emptyRows({
        aggregates: [
          aggregateRow(21_000, 'kitchen', 'msum', {
            movingStateFunction: 'kitchen.sum_step',
            movingInverseFunction: 'kitchen.sum_unstep',
            movingStateType: 'numeric',
          }),
        ],
      }),
      FACTS
    );

    expect(model.aggregates[0].moving).toStrictEqual({
      stateFunction: 'kitchen.sum_step',
      inverseFunction: 'kitchen.sum_unstep',
      stateType: 'numeric',
      finalFunctionExtra: false,
      finalFunctionModify: 'READ_ONLY',
    });
  });

  it('reads a key with neither a column nor an expression as an empty expression', () => {
    // pg_get_indexdef() returns null for an index that was dropped after the
    // introspection's snapshot was taken.
    const model = rowsToModel(
      emptyRows({
        tables: [tableRow(21_010, 'kitchen', 'orders')],
        indexes: [
          indexRow(21_011, 'kitchen', 'orders_gone_idx', 21_010, {
            keys: [
              {
                column: null,
                expression: null,
                opclass: null,
                collation: null,
                descending: false,
                nullsFirst: false,
              },
            ],
          }),
        ],
      }),
      FACTS
    );

    expect(model.indexes[0].keys).toStrictEqual([
      { expression: '', descending: false, nullsFirst: false },
    ]);
  });

  it('ignores a NOT NULL constraint without a column', () => {
    const model = rowsToModel(
      emptyRows({
        tables: [tableRow(21_020, 'kitchen', 'parcels')],
        columns: [columnRow(21_020, 1, 'id', 'integer', { attnotnull: true })],
        constraints: [
          constraintRow(
            21_021,
            'kitchen',
            'parcels_id_not_null',
            21_020,
            'n',
            'NOT NULL id'
          ),
        ],
      }),
      FACTS
    );

    expect(model.tables[0].columns[0]).not.toHaveProperty('notNullConstraint');
    expect(model.constraints).toStrictEqual([]);
  });

  it('leaves out the statistics objects of an excluded schema, even on a kept table', () => {
    const model = rowsToModel(
      emptyRows({
        tables: [tableRow(21_030, 'kitchen', 'orders')],
        statistics: [
          statisticsRow(
            21_031,
            'stats',
            'orders_stats',
            21_030,
            'CREATE STATISTICS stats.orders_stats ON id, status FROM kitchen.orders'
          ),
          statisticsRow(
            21_032,
            'kitchen',
            'orders_kept_stats',
            21_030,
            'CREATE STATISTICS kitchen.orders_kept_stats ON id, status FROM kitchen.orders'
          ),
        ],
      }),
      { ...FACTS, excludeSchemas: ['stats'] }
    );

    expect(model.statistics.map(({ name }) => name)).toStrictEqual([
      'orders_kept_stats',
    ]);
  });

  it('leaves out the constraints, indexes and dependencies of relations that are not in the model', () => {
    const model = rowsToModel(
      emptyRows({
        tables: [tableRow(21_040, 'kitchen', 'orders')],
        constraints: [
          constraintRow(
            21_041,
            'kitchen',
            'lost_pkey',
            21_999,
            'p',
            'PRIMARY KEY (id)'
          ),
        ],
        indexes: [indexRow(21_042, 'kitchen', 'lost_idx', 21_999)],
        dependencies: [
          dependencyRow('pg_class', 21_040, 'pg_class', 21_042),
          dependencyRow('pg_amproc', 21_043, 'pg_class', 21_040),
        ],
      }),
      FACTS
    );

    expect(model.constraints).toStrictEqual([]);
    expect(model.indexes).toStrictEqual([]);
    expect(model.dependencies).toStrictEqual([]);
  });

  it('gives no owned sequence to a column that the migrations table owns, nor keeps that sequence', () => {
    const model = rowsToModel(
      emptyRows({
        sequences: [
          sequenceRow(21_050, 'public', 'pgmigrations_names', {
            ownerSchema: 'public',
            ownerTable: 'pgmigrations',
            ownerColumn: 'name',
          }),
          sequenceRow(21_051, 'public', 'pgmigrations_ids', {
            ownerSchema: 'app',
            ownerTable: 'pgmigrations',
            ownerColumn: 'id',
          }),
        ],
      }),
      FACTS
    );

    expect(model.sequences.map(({ name }) => name)).toStrictEqual([
      'pgmigrations_ids',
    ]);
  });
});
