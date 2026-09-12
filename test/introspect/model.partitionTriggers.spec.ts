import { describe, expect, it } from 'vitest';
import { rowsToModel } from '../../src/introspect/core/model';
import type {
  PartitionTriggerRow,
  SchemaModel,
} from '../../src/introspect/types';
import { emptyRows, FACTS, tableRow, triggerRow } from './rows';

// The clones of a trigger of a partitioned table on its partitions go with
// that trigger, so that their firing modes and comments can be restored
// after it.

const ORDERS = 23_001;
const ORDERS_2025 = 23_002;
const ORDERS_2026 = 23_003;
const ORDERS_2026_EU = 23_004;
const ORDERS_2024 = 23_005;

/**
 * A partitioned table `kitchen.orders` with partitions `…_2025` and
 * `…_2026`, which has a partition `…_2026_eu` itself, and a partition
 * `archive.orders_2024` in a schema that the specs leave out.
 */
const TABLES = [
  tableRow(ORDERS, 'kitchen', 'orders', { relkind: 'p' }),
  tableRow(ORDERS_2025, 'kitchen', 'orders_2025', {
    relispartition: true,
    partitionBound: "FOR VALUES FROM ('2025-01-01') TO ('2026-01-01')",
    inherits: [{ schema: 'kitchen', name: 'orders' }],
  }),
  tableRow(ORDERS_2026, 'kitchen', 'orders_2026', {
    relkind: 'p',
    relispartition: true,
    partitionBound: "FOR VALUES FROM ('2026-01-01') TO ('2027-01-01')",
    inherits: [{ schema: 'kitchen', name: 'orders' }],
  }),
  tableRow(ORDERS_2026_EU, 'kitchen', 'orders_2026_eu', {
    relispartition: true,
    partitionBound: "FOR VALUES IN ('eu')",
    inherits: [{ schema: 'kitchen', name: 'orders_2026' }],
  }),
  tableRow(ORDERS_2024, 'archive', 'orders_2024', {
    relispartition: true,
    partitionBound: "FOR VALUES FROM ('2024-01-01') TO ('2025-01-01')",
    inherits: [{ schema: 'kitchen', name: 'orders' }],
  }),
];

const WITHOUT_ARCHIVE = { ...FACTS, excludeSchemas: ['archive'] };

/**
 * A row of the `partitionTriggers` query.
 */
function partitionTriggerRow(
  oid: number,
  relid: number,
  parent: number,
  fields: Partial<PartitionTriggerRow> = {}
): PartitionTriggerRow {
  return { oid, relid, parent, tgenabled: 'O', comment: null, ...fields };
}

function needs(model: SchemaModel, trigger: number): string[] {
  return model.dependencies
    .filter(({ from }) => from.kind === 'trigger' && from.oid === trigger)
    .map(({ to }) => `${to.kind}:${to.oid}`);
}

describe('rowsToModel', () => {
  describe('partition triggers', () => {
    it('gives a trigger its clones on the partitions, and theirs, sorted by table', () => {
      const model = rowsToModel(
        emptyRows({
          tables: TABLES,
          triggers: [triggerRow(23_010, 'kitchen', 'orders_audit', ORDERS)],
          partitionTriggers: [
            partitionTriggerRow(23_011, ORDERS_2026, 23_010),
            partitionTriggerRow(23_012, ORDERS_2025, 23_010, {
              tgenabled: 'D',
              comment: 'Off for 2025',
            }),
            partitionTriggerRow(23_013, ORDERS_2026_EU, 23_011, {
              tgenabled: 'A',
            }),
          ],
        }),
        WITHOUT_ARCHIVE
      );

      expect(model.triggers).toHaveLength(1);
      expect(model.triggers[0].partitionTriggers).toStrictEqual([
        {
          table: { schema: 'kitchen', name: 'orders_2025' },
          enabled: 'DISABLED',
          comment: 'Off for 2025',
        },
        {
          table: { schema: 'kitchen', name: 'orders_2026' },
          enabled: 'ORIGIN',
          partitionTriggers: [
            {
              table: { schema: 'kitchen', name: 'orders_2026_eu' },
              enabled: 'ALWAYS',
            },
          ],
        },
      ]);
      // The trigger needs the partitions that its clones are on, down the
      // tree.
      expect(needs(model, 23_010)).toStrictEqual([
        `table:${ORDERS}`,
        `table:${ORDERS_2025}`,
        `table:${ORDERS_2026}`,
        `table:${ORDERS_2026_EU}`,
      ]);
    });

    it('leaves out the clones on partitions that are not in the model, and the field when none is left', () => {
      const model = rowsToModel(
        emptyRows({
          tables: TABLES,
          triggers: [
            triggerRow(23_020, 'kitchen', 'orders_audit', ORDERS),
            triggerRow(23_030, 'kitchen', 'orders_touch', ORDERS),
          ],
          partitionTriggers: [
            partitionTriggerRow(23_021, ORDERS_2024, 23_020, {
              tgenabled: 'R',
              comment: 'Archived',
            }),
            partitionTriggerRow(23_022, ORDERS_2025, 23_020, {
              tgenabled: 'D',
            }),
            partitionTriggerRow(23_031, ORDERS_2024, 23_030, {
              tgenabled: 'D',
            }),
          ],
        }),
        WITHOUT_ARCHIVE
      );

      const [audit, touch] = model.triggers;
      expect(audit.partitionTriggers).toStrictEqual([
        {
          table: { schema: 'kitchen', name: 'orders_2025' },
          enabled: 'DISABLED',
        },
      ]);
      expect(touch.name).toBe('orders_touch');
      expect(touch).not.toHaveProperty('partitionTriggers');
      expect(needs(model, 23_020)).toStrictEqual([
        `table:${ORDERS}`,
        `table:${ORDERS_2025}`,
      ]);
      expect(needs(model, 23_030)).toStrictEqual([`table:${ORDERS}`]);
    });
  });
});
