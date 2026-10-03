import { describe, expect, it } from 'vitest';
import { emitTrigger } from '../../../src/codegen/emitters/triggers';
import type {
  FiringMode,
  PartitionTrigger,
  Trigger,
} from '../../../src/introspect/types';
import { makeTrigger } from '../../introspect/objects';
import {
  expectCode,
  expectFallback,
  expectSql,
  expectSqlThenAnyOrder,
} from '../expectations';
import { emitAndRun } from '../run';

const PRODUCTS = { schema: 'kitchen', name: 'products' };
const ORDERS = { schema: 'public', name: 'orders' };
const MEASUREMENTS = { schema: 'kitchen', name: 'measurements' };

/**
 * The clone of a trigger on a partition of `kitchen.measurements`.
 */
function clone(
  table: string,
  enabled: FiringMode,
  fields: Partial<PartitionTrigger> = {}
): PartitionTrigger {
  return { table: { schema: 'kitchen', name: table }, enabled, ...fields };
}

describe('emitTrigger', () => {
  it.each<[string, Trigger, string]>([
    [
      'a row trigger with arguments and a WHEN condition',
      makeTrigger(PRODUCTS, 'products_touch', {
        timing: 'BEFORE',
        events: ['UPDATE'],
        function: { schema: 'kitchen', name: 'touch_updated_at' },
        args: ['price', "it's {x}"],
        condition: '(old.price IS DISTINCT FROM new.price)',
        comment: 'Set by a comment step',
      }),
      `CREATE TRIGGER "products_touch" BEFORE UPDATE ON "kitchen"."products" FOR EACH ROW
       WHEN ((old.price IS DISTINCT FROM new.price))
       EXECUTE FUNCTION "kitchen"."touch_updated_at"('price', 'it''s {x}');`,
    ],
    [
      'a statement trigger on several events with a function of the default schema',
      makeTrigger(ORDERS, 'orders_changed', {
        events: ['INSERT', 'DELETE'],
        level: 'STATEMENT',
        function: { schema: 'public', name: 'log_change' },
      }),
      'CREATE TRIGGER "orders_changed" AFTER INSERT OR DELETE ON "orders" FOR EACH STATEMENT EXECUTE FUNCTION "log_change"();',
    ],
    [
      'a TRUNCATE trigger',
      makeTrigger(ORDERS, 'orders_truncated', {
        events: ['TRUNCATE'],
        level: 'STATEMENT',
        function: { schema: 'public', name: 'log_change' },
      }),
      'CREATE TRIGGER "orders_truncated" AFTER TRUNCATE ON "orders" FOR EACH STATEMENT EXECUTE FUNCTION "log_change"();',
    ],
    [
      'an INSTEAD OF trigger on a view',
      makeTrigger(
        { schema: 'kitchen', name: 'order_summary' },
        'order_summary_insert',
        {
          timing: 'INSTEAD OF',
          events: ['INSERT'],
          function: { schema: 'kitchen', name: 'insert_order_summary' },
        }
      ),
      'CREATE TRIGGER "order_summary_insert" INSTEAD OF INSERT ON "kitchen"."order_summary" FOR EACH ROW EXECUTE FUNCTION "kitchen"."insert_order_summary"();',
    ],
    [
      'a deferrable constraint trigger',
      makeTrigger(
        { schema: 'kitchen', name: 'order_lines' },
        'order_lines_check',
        {
          events: ['INSERT', 'UPDATE'],
          function: { schema: 'kitchen', name: 'check_order_line' },
          constraint: true,
          deferrable: true,
          deferred: true,
        }
      ),
      'CREATE CONSTRAINT TRIGGER "order_lines_check" AFTER INSERT OR UPDATE ON "kitchen"."order_lines" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "kitchen"."check_order_line"();',
    ],
    [
      'a constraint trigger that is not deferrable',
      makeTrigger(
        { schema: 'kitchen', name: 'order_lines' },
        'order_lines_now',
        {
          function: { schema: 'kitchen', name: 'check_order_line' },
          constraint: true,
        }
      ),
      'CREATE CONSTRAINT TRIGGER "order_lines_now" AFTER INSERT ON "kitchen"."order_lines" NOT DEFERRABLE FOR EACH ROW EXECUTE FUNCTION "kitchen"."check_order_line"();',
    ],
    [
      'a row trigger on UPDATE OF two columns',
      makeTrigger(PRODUCTS, 'products_touch', {
        timing: 'BEFORE',
        events: ['UPDATE'],
        updateOf: ['price', 'discount_pct'],
        function: { schema: 'kitchen', name: 'touch_updated_at' },
      }),
      'CREATE TRIGGER "products_touch" BEFORE UPDATE OF price, discount_pct ON "kitchen"."products" FOR EACH ROW EXECUTE FUNCTION "kitchen"."touch_updated_at"();',
    ],
    [
      'a trigger on INSERT and UPDATE OF columns whose names need quotes',
      makeTrigger(ORDERS, 'orders_flagged', {
        events: ['INSERT', 'UPDATE'],
        updateOf: ['isMember', 'order', 'a"b', 'in stock'],
        function: { schema: 'public', name: 'log_change' },
      }),
      'CREATE TRIGGER "orders_flagged" AFTER INSERT OR UPDATE OF "isMember", "order", "a""b", "in stock" ON "orders" FOR EACH ROW EXECUTE FUNCTION "log_change"();',
    ],
    [
      'a statement trigger on UPDATE OF a column and DELETE',
      makeTrigger(ORDERS, 'orders_status', {
        events: ['UPDATE', 'DELETE'],
        updateOf: ['status'],
        level: 'STATEMENT',
        function: { schema: 'public', name: 'log_change' },
      }),
      'CREATE TRIGGER "orders_status" AFTER UPDATE OF status OR DELETE ON "orders" FOR EACH STATEMENT EXECUTE FUNCTION "log_change"();',
    ],
    [
      'a constraint trigger on UPDATE OF a column',
      makeTrigger(
        { schema: 'kitchen', name: 'order_lines' },
        'order_lines_quantity',
        {
          events: ['UPDATE'],
          updateOf: ['quantity'],
          function: { schema: 'kitchen', name: 'check_order_line' },
          constraint: true,
          deferrable: true,
        }
      ),
      'CREATE CONSTRAINT TRIGGER "order_lines_quantity" AFTER UPDATE OF quantity ON "kitchen"."order_lines" DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION "kitchen"."check_order_line"();',
    ],
  ])('creates %s with pgm.createTrigger', (_, trigger, expected) => {
    const result = emitAndRun(emitTrigger, trigger);

    expectCode(result);
    expect(result.calls).toStrictEqual(['createTrigger']);
    expectSql(result, expected);
  });

  it.each<[string, string, Partial<Trigger>]>([
    [
      'a transition table',
      'transition tables',
      {
        level: 'STATEMENT',
        newTable: 'new_rows',
        definition:
          'CREATE TRIGGER t AFTER INSERT ON kitchen.products REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION kitchen.log_rows()',
      },
    ],
  ])('falls back to pg_get_triggerdef for %s', (_, reason, fields) => {
    const trigger = makeTrigger(PRODUCTS, 't', fields);
    const result = emitAndRun(emitTrigger, trigger);

    expectFallback(result, reason);
    expect(result.calls).toStrictEqual(['sql']);
    expectSql(result, trigger.definition);
  });

  it.each([
    ['DISABLED', 'DISABLE TRIGGER'],
    ['REPLICA', 'ENABLE REPLICA TRIGGER'],
    ['ALWAYS', 'ENABLE ALWAYS TRIGGER'],
  ] as const)(
    'sets the firing mode %s after creating the trigger',
    (enabled, action) => {
      const result = emitAndRun(
        emitTrigger,
        makeTrigger(PRODUCTS, 'products_audit', {
          function: { schema: 'kitchen', name: 'audit' },
          enabled,
          definition:
            'CREATE TRIGGER products_audit AFTER INSERT ON kitchen.products FOR EACH ROW EXECUTE FUNCTION kitchen.audit()',
        })
      );

      expectFallback(result, 'firing mode');
      expectSqlThenAnyOrder(
        result,
        `CREATE TRIGGER "products_audit" AFTER INSERT ON "kitchen"."products" FOR EACH ROW EXECUTE FUNCTION "kitchen"."audit"();
       ALTER TABLE "kitchen"."products" ${action} "products_audit";`
      );
    }
  );

  it('gives every reason when there are several', () => {
    const trigger = makeTrigger(PRODUCTS, 't', {
      level: 'STATEMENT',
      newTable: 'new_rows',
      enabled: 'DISABLED',
      definition:
        'CREATE TRIGGER t AFTER INSERT ON kitchen.products REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION kitchen.log_rows()',
    });
    const result = emitAndRun(emitTrigger, trigger);

    expectFallback(result, 'transition tables', 'firing mode');
    expectSqlThenAnyOrder(
      result,
      `${trigger.definition};
       ALTER TABLE "kitchen"."products" DISABLE TRIGGER "t";`
    );
  });

  it('creates a trigger on UPDATE OF columns with pgm.createTrigger, then sets its firing mode', () => {
    const result = emitAndRun(
      emitTrigger,
      makeTrigger(PRODUCTS, 't', {
        timing: 'BEFORE',
        events: ['UPDATE'],
        updateOf: ['price'],
        function: { schema: 'kitchen', name: 'on_change' },
        enabled: 'DISABLED',
      })
    );

    expectFallback(result, 'firing mode');
    expect(result.calls).toStrictEqual(['createTrigger', 'sql']);
    expectSqlThenAnyOrder(
      result,
      `CREATE TRIGGER "t" BEFORE UPDATE OF price ON "kitchen"."products" FOR EACH ROW EXECUTE FUNCTION "kitchen"."on_change"();
       ALTER TABLE "kitchen"."products" DISABLE TRIGGER "t";`
    );
  });

  describe('with clones on partitions', () => {
    it('gives each clone that fires unlike the trigger it is a clone of its firing mode, a partition before its own partitions', () => {
      const result = emitAndRun(
        emitTrigger,
        makeTrigger(MEASUREMENTS, 'm_touch', {
          timing: 'BEFORE',
          function: { schema: 'kitchen', name: 'touch' },
          partitionTriggers: [
            clone('measurements_2025', 'DISABLED'),
            clone('measurements_2026', 'REPLICA', {
              partitionTriggers: [
                clone('measurements_2026_eu', 'REPLICA'),
                clone('measurements_2026_us', 'ORIGIN'),
              ],
            }),
            clone('measurements_2027', 'ORIGIN'),
            clone('measurements_2028', 'ALWAYS'),
          ],
        })
      );

      expectFallback(result, 'firing mode');
      expect(result.calls).toStrictEqual([
        'createTrigger',
        'sql',
        'sql',
        'sql',
        'sql',
      ]);
      expectSql(
        result,
        `CREATE TRIGGER "m_touch" BEFORE INSERT ON "kitchen"."measurements" FOR EACH ROW EXECUTE FUNCTION "kitchen"."touch"();
         ALTER TABLE "kitchen"."measurements_2025" DISABLE TRIGGER "m_touch";
         ALTER TABLE "kitchen"."measurements_2026" ENABLE REPLICA TRIGGER "m_touch";
         ALTER TABLE "kitchen"."measurements_2026_us" ENABLE TRIGGER "m_touch";
         ALTER TABLE "kitchen"."measurements_2028" ENABLE ALWAYS TRIGGER "m_touch";`
      );
    });

    it('enables a clone of a disabled trigger after disabling the trigger, and gives the firing mode reason once', () => {
      const result = emitAndRun(
        emitTrigger,
        makeTrigger(MEASUREMENTS, 'm_audit', {
          enabled: 'DISABLED',
          partitionTriggers: [
            clone('measurements_2025', 'DISABLED'),
            clone('measurements_2026', 'ORIGIN'),
          ],
        })
      );

      expectFallback(result, 'firing mode');
      expect(result.calls).toStrictEqual(['createTrigger', 'sql', 'sql']);
      expectSql(
        result,
        `CREATE TRIGGER "m_audit" AFTER INSERT ON "kitchen"."measurements" FOR EACH ROW EXECUTE FUNCTION "kitchen"."on_change"();
         ALTER TABLE "kitchen"."measurements" DISABLE TRIGGER "m_audit";
         ALTER TABLE "kitchen"."measurements_2026" ENABLE TRIGGER "m_audit";`
      );
    });

    it('comments on the clones that fire like the trigger, with only the comment reason', () => {
      const result = emitAndRun(
        emitTrigger,
        makeTrigger(MEASUREMENTS, 'm_touch', {
          partitionTriggers: [
            clone('measurements_2025', 'ORIGIN'),
            clone('measurements_2026', 'ORIGIN', {
              partitionTriggers: [
                clone('measurements_2026_eu', 'ORIGIN', {
                  comment: "Fires on the EU partition's rows",
                }),
              ],
            }),
          ],
        })
      );

      expectFallback(result, 'comment on trigger');
      expect(result.calls).toStrictEqual(['createTrigger', 'sql']);
      expectSql(
        result,
        `CREATE TRIGGER "m_touch" AFTER INSERT ON "kitchen"."measurements" FOR EACH ROW EXECUTE FUNCTION "kitchen"."on_change"();
         COMMENT ON TRIGGER "m_touch" ON "kitchen"."measurements_2026_eu" IS 'Fires on the EU partition''s rows';`
      );
    });

    it('comments on the clones last, after the definition and the firing modes, and gives the reasons in order', () => {
      const trigger = makeTrigger(MEASUREMENTS, 'm_touch', {
        timing: 'BEFORE',
        events: ['UPDATE'],
        updateOf: ['value'],
        definition:
          'CREATE TRIGGER m_touch BEFORE UPDATE OF value ON kitchen.measurements FOR EACH ROW EXECUTE FUNCTION kitchen.on_change()',
        partitionTriggers: [
          clone('measurements_2025', 'DISABLED', {
            comment: 'Disabled on the first partition',
          }),
          clone('measurements_2026', 'ORIGIN', {
            comment: 'Fires on the second partition',
          }),
        ],
      });
      const result = emitAndRun(emitTrigger, trigger);

      expectFallback(result, 'firing mode', 'comment on trigger');
      expect(result.calls).toStrictEqual([
        'createTrigger',
        'sql',
        'sql',
        'sql',
      ]);
      expectSql(
        result,
        `CREATE TRIGGER "m_touch" BEFORE UPDATE OF value ON "kitchen"."measurements" FOR EACH ROW EXECUTE FUNCTION "kitchen"."on_change"();
         ALTER TABLE "kitchen"."measurements_2025" DISABLE TRIGGER "m_touch";
         COMMENT ON TRIGGER "m_touch" ON "kitchen"."measurements_2025" IS 'Disabled on the first partition';
         COMMENT ON TRIGGER "m_touch" ON "kitchen"."measurements_2026" IS 'Fires on the second partition';`
      );
    });
  });
});
