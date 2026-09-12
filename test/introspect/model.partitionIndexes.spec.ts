import { describe, expect, it } from 'vitest';
import { rowsToModel } from '../../src/introspect/core/model';
import type {
  PartitionIndexRow,
  SchemaModel,
} from '../../src/introspect/types';
import { constraintRow, emptyRows, FACTS, indexRow, tableRow } from './rows';

// The indexes of partitions attached to the index of their partitioned
// table (or of its constraint) go with that index, so that the ones with a
// name of their own can be created before it.

const MEASUREMENTS = 22_001;
const MEASUREMENTS_2025 = 22_002;
const MEASUREMENTS_2026 = 22_003;
const MEASUREMENTS_2026_EU = 22_004;

/**
 * A partitioned table `kitchen.measurements` with partitions `…_2025` and
 * `…_2026`, which has a partition `…_2026_eu` itself.
 */
const TABLES = [
  tableRow(MEASUREMENTS, 'kitchen', 'measurements', { relkind: 'p' }),
  tableRow(MEASUREMENTS_2025, 'kitchen', 'measurements_2025', {
    relispartition: true,
    partitionBound: "FOR VALUES FROM ('2025-01-01') TO ('2026-01-01')",
    inherits: [{ schema: 'kitchen', name: 'measurements' }],
  }),
  tableRow(MEASUREMENTS_2026, 'kitchen', 'measurements_2026', {
    relkind: 'p',
    relispartition: true,
    partitionBound: "FOR VALUES FROM ('2026-01-01') TO ('2027-01-01')",
    inherits: [{ schema: 'kitchen', name: 'measurements' }],
  }),
  tableRow(MEASUREMENTS_2026_EU, 'kitchen', 'measurements_2026_eu', {
    relispartition: true,
    partitionBound: "FOR VALUES IN ('eu')",
    inherits: [{ schema: 'kitchen', name: 'measurements_2026' }],
  }),
];

/**
 * A row of the `partitionIndexes` query.
 */
function partitionIndexRow(
  oid: number,
  name: string,
  relid: number,
  parent: number,
  fields: Partial<PartitionIndexRow> = {}
): PartitionIndexRow {
  return {
    oid,
    schema: 'kitchen',
    name,
    relid,
    parent,
    columns: ['value'],
    definition: `CREATE INDEX ${name} ON kitchen.t USING btree (value)`,
    constraintDefinition: null,
    ...fields,
  };
}

function refs(model: SchemaModel): string[] {
  return model.dependencies.map(
    ({ from, to }) => `${from.kind}:${from.oid} -> ${to.kind}:${to.oid}`
  );
}

describe('rowsToModel', () => {
  describe('partition indexes', () => {
    it('gives an index the indexes of partitions attached to it, deepest first', () => {
      const model = rowsToModel(
        emptyRows({
          tables: TABLES,
          indexes: [
            indexRow(22_010, 'kitchen', 'measurements_value_idx', MEASUREMENTS),
          ],
          partitionIndexes: [
            partitionIndexRow(
              22_011,
              'measurements_2025_value_idx',
              MEASUREMENTS_2025,
              22_010
            ),
            partitionIndexRow(
              22_012,
              'measurements_2026_value_idx',
              MEASUREMENTS_2026,
              22_010,
              {
                definition:
                  'CREATE INDEX measurements_2026_value_idx ON ONLY kitchen.measurements_2026 USING btree (value)',
              }
            ),
            partitionIndexRow(
              22_013,
              'eu_values',
              MEASUREMENTS_2026_EU,
              22_012
            ),
          ],
        }),
        FACTS
      );

      expect(model.indexes).toHaveLength(1);
      expect(model.indexes[0].partitionIndexes).toStrictEqual([
        {
          table: { schema: 'kitchen', name: 'measurements_2026_eu' },
          name: 'eu_values',
          columns: ['value'],
          definition: 'CREATE INDEX eu_values ON kitchen.t USING btree (value)',
          level: 2,
        },
        {
          table: { schema: 'kitchen', name: 'measurements_2025' },
          name: 'measurements_2025_value_idx',
          columns: ['value'],
          definition:
            'CREATE INDEX measurements_2025_value_idx ON kitchen.t USING btree (value)',
          level: 1,
        },
        {
          table: { schema: 'kitchen', name: 'measurements_2026' },
          name: 'measurements_2026_value_idx',
          columns: ['value'],
          definition:
            'CREATE INDEX measurements_2026_value_idx ON ONLY kitchen.measurements_2026 USING btree (value)',
          level: 1,
        },
      ]);
      // The index needs the partitions whose indexes it attaches.
      expect(refs(model)).toEqual(
        expect.arrayContaining([
          `index:22010 -> table:${MEASUREMENTS_2025}`,
          `index:22010 -> table:${MEASUREMENTS_2026}`,
          `index:22010 -> table:${MEASUREMENTS_2026_EU}`,
        ])
      );
    });

    it('gives a primary key, unique or exclusion constraint the constraints of partitions attached to its index', () => {
      const model = rowsToModel(
        emptyRows({
          tables: TABLES,
          constraints: [
            constraintRow(
              22_020,
              'kitchen',
              'measurements_pkey',
              MEASUREMENTS,
              'p',
              'PRIMARY KEY (sensor_id, measured_at)',
              { conindid: 22_021 }
            ),
            constraintRow(
              22_022,
              'kitchen',
              'measurements_value_check',
              MEASUREMENTS,
              'c',
              'CHECK ((value > (0)::double precision))',
              { conindid: 22_021 }
            ),
          ],
          partitionIndexes: [
            partitionIndexRow(
              22_023,
              'measurements_2025_key',
              MEASUREMENTS_2025,
              22_021,
              {
                columns: ['sensor_id', 'measured_at'],
                constraintDefinition: 'PRIMARY KEY (sensor_id, measured_at)',
              }
            ),
          ],
        }),
        FACTS
      );

      const [primaryKey, check] = model.constraints;
      expect(primaryKey.partitionIndexes).toStrictEqual([
        {
          table: { schema: 'kitchen', name: 'measurements_2025' },
          name: 'measurements_2025_key',
          columns: ['sensor_id', 'measured_at'],
          definition:
            'CREATE INDEX measurements_2025_key ON kitchen.t USING btree (value)',
          constraintDefinition: 'PRIMARY KEY (sensor_id, measured_at)',
          level: 1,
        },
      ]);
      expect(check).not.toHaveProperty('partitionIndexes');
      expect(refs(model)).toContain(
        `constraint:22020 -> table:${MEASUREMENTS_2025}`
      );
    });

    it('leaves out the field without partition indexes, and an index of a table that is not read', () => {
      const model = rowsToModel(
        emptyRows({
          tables: TABLES,
          indexes: [
            indexRow(22_030, 'kitchen', 'measurements_value_idx', MEASUREMENTS),
            indexRow(22_031, 'kitchen', 'measurements_label_idx', MEASUREMENTS),
          ],
          partitionIndexes: [
            partitionIndexRow(22_032, 'lost_values', 99_999, 22_030),
          ],
        }),
        FACTS
      );

      expect(
        model.indexes.map((index) => Object.hasOwn(index, 'partitionIndexes'))
      ).toStrictEqual([false, false]);
    });

    it('gives an index that is not valid the parent of its partition indexes from level 2 on, and every partition below its table', () => {
      // The same partition indexes attached to an index ON ONLY the table
      // that is not valid, and to a valid one: only the first attaches them
      // one at a time, and gets the partitions that have no index attached.
      const model = rowsToModel(
        emptyRows({
          tables: TABLES,
          indexes: [
            indexRow(
              22_040,
              'kitchen',
              'measurements_value_idx',
              MEASUREMENTS,
              {
                indisvalid: false,
              }
            ),
            indexRow(
              22_050,
              'kitchen',
              'measurements_label_idx',
              MEASUREMENTS,
              {
                indisvalid: true,
              }
            ),
          ],
          partitionIndexes: [
            partitionIndexRow(
              22_041,
              'measurements_2026_value_idx',
              MEASUREMENTS_2026,
              22_040
            ),
            partitionIndexRow(
              22_042,
              'eu_values',
              MEASUREMENTS_2026_EU,
              22_041
            ),
            partitionIndexRow(
              22_051,
              'measurements_2026_label_idx',
              MEASUREMENTS_2026,
              22_050
            ),
            partitionIndexRow(
              22_052,
              'eu_labels',
              MEASUREMENTS_2026_EU,
              22_051
            ),
          ],
        }),
        FACTS
      );

      const [valid, invalid] = model.indexes;
      expect(invalid.name).toBe('measurements_value_idx');
      expect(invalid.valid).toBe(false);
      expect(invalid.partitionIndexes).toStrictEqual([
        {
          table: { schema: 'kitchen', name: 'measurements_2026_eu' },
          name: 'eu_values',
          columns: ['value'],
          definition: 'CREATE INDEX eu_values ON kitchen.t USING btree (value)',
          level: 2,
          parent: { schema: 'kitchen', name: 'measurements_2026_value_idx' },
        },
        {
          table: { schema: 'kitchen', name: 'measurements_2026' },
          name: 'measurements_2026_value_idx',
          columns: ['value'],
          definition:
            'CREATE INDEX measurements_2026_value_idx ON kitchen.t USING btree (value)',
          level: 1,
        },
      ]);
      expect(valid.name).toBe('measurements_label_idx');
      expect(valid).not.toHaveProperty('valid');
      expect(
        valid.partitionIndexes?.map((index) => Object.hasOwn(index, 'parent'))
      ).toStrictEqual([false, false]);
      // Creating a partition attaches its index to the index that is not
      // valid, so that index comes after every partition, down the tree.
      expect(
        refs(model).filter((ref) => ref.startsWith('index:22040 '))
      ).toStrictEqual([
        `index:22040 -> table:${MEASUREMENTS}`,
        `index:22040 -> table:${MEASUREMENTS_2025}`,
        `index:22040 -> table:${MEASUREMENTS_2026}`,
        `index:22040 -> table:${MEASUREMENTS_2026_EU}`,
      ]);
      expect(
        refs(model).filter((ref) => ref.startsWith('index:22050 '))
      ).toStrictEqual([
        `index:22050 -> table:${MEASUREMENTS}`,
        `index:22050 -> table:${MEASUREMENTS_2026}`,
        `index:22050 -> table:${MEASUREMENTS_2026_EU}`,
      ]);
    });

    it('makes an index that is not valid need the partitions of partitions too, when none of their indexes is attached', () => {
      const model = rowsToModel(
        emptyRows({
          tables: TABLES,
          indexes: [
            indexRow(
              22_045,
              'kitchen',
              'measurements_value_idx',
              MEASUREMENTS,
              {
                indisvalid: false,
              }
            ),
          ],
        }),
        FACTS
      );

      expect(model.indexes[0].valid).toBe(false);
      expect(model.indexes[0]).not.toHaveProperty('partitionIndexes');
      expect(refs(model)).toStrictEqual([
        `index:22045 -> table:${MEASUREMENTS}`,
        `index:22045 -> table:${MEASUREMENTS_2025}`,
        `index:22045 -> table:${MEASUREMENTS_2026}`,
        `index:22045 -> table:${MEASUREMENTS_2026_EU}`,
        `table:${MEASUREMENTS_2025} -> table:${MEASUREMENTS}`,
        `table:${MEASUREMENTS_2026} -> table:${MEASUREMENTS}`,
        `table:${MEASUREMENTS_2026_EU} -> table:${MEASUREMENTS_2026}`,
      ]);
    });

    it('keeps the storage parameters, clustering, replica identity and comment of a partition index, and leaves them out when it has none', () => {
      const model = rowsToModel(
        emptyRows({
          tables: TABLES,
          indexes: [
            indexRow(22_060, 'kitchen', 'measurements_value_idx', MEASUREMENTS),
          ],
          partitionIndexes: [
            partitionIndexRow(
              22_061,
              'measurements_2025_value_idx',
              MEASUREMENTS_2025,
              22_060,
              {
                reloptions: ['fillfactor=70'],
                indisclustered: true,
                indisreplident: true,
                comment: 'Values of 2025',
              }
            ),
            partitionIndexRow(
              22_062,
              'measurements_2026_value_idx',
              MEASUREMENTS_2026,
              22_060,
              {
                reloptions: null,
                indisclustered: false,
                indisreplident: false,
                comment: null,
              }
            ),
          ],
        }),
        FACTS
      );

      expect(model.indexes[0].partitionIndexes).toStrictEqual([
        {
          table: { schema: 'kitchen', name: 'measurements_2025' },
          name: 'measurements_2025_value_idx',
          columns: ['value'],
          definition:
            'CREATE INDEX measurements_2025_value_idx ON kitchen.t USING btree (value)',
          level: 1,
          options: ['fillfactor=70'],
          clustered: true,
          replicaIdentity: true,
          comment: 'Values of 2025',
        },
        {
          table: { schema: 'kitchen', name: 'measurements_2026' },
          name: 'measurements_2026_value_idx',
          columns: ['value'],
          definition:
            'CREATE INDEX measurements_2026_value_idx ON kitchen.t USING btree (value)',
          level: 1,
        },
      ]);
    });
  });
});
