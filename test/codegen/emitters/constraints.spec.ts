import { describe, expect, it } from 'vitest';
import { emitConstraint } from '../../../src/codegen/emitters/constraints';
import type { Constraint } from '../../../src/introspect/types';
import { makeConstraint } from '../../introspect/objects';
import {
  expectCode,
  expectFallback,
  expectSql,
  expectSqlThenAnyOrder,
} from '../expectations';
import { emitAndRun } from '../run';

const ORDERS = { schema: 'public', name: 'orders' };
const ORDER_LINES = { schema: 'kitchen', name: 'order_lines' };

describe('emitConstraint', () => {
  it.each<[string, Constraint, string]>([
    [
      'a primary key',
      makeConstraint(ORDERS, 'orders_pkey', 'primaryKey', 'PRIMARY KEY (id)', {
        comment: 'Set by a comment step',
        indexComment: 'Set by a comment step',
      }),
      'ALTER TABLE "orders" ADD CONSTRAINT "orders_pkey" PRIMARY KEY (id);',
    ],
    [
      'a deferrable foreign key of another schema',
      makeConstraint(
        ORDER_LINES,
        'order_lines_order_fkey',
        'foreignKey',
        'FOREIGN KEY (order_id) REFERENCES kitchen.orders(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED',
        {
          deferrable: true,
          deferred: true,
          references: { schema: 'kitchen', name: 'orders' },
        }
      ),
      'ALTER TABLE "kitchen"."order_lines" ADD CONSTRAINT "order_lines_order_fkey" FOREIGN KEY (order_id) REFERENCES kitchen.orders(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;',
    ],
    [
      'a CHECK that is not valid',
      makeConstraint(
        ORDER_LINES,
        'order_lines_quantity_check',
        'check',
        'CHECK ((quantity > 0)) NOT VALID',
        { validated: false }
      ),
      'ALTER TABLE "kitchen"."order_lines" ADD CONSTRAINT "order_lines_quantity_check" CHECK ((quantity > 0)) NOT VALID;',
    ],
    [
      'a unique constraint',
      makeConstraint(ORDERS, 'orders_code_key', 'unique', 'UNIQUE (code)'),
      'ALTER TABLE "orders" ADD CONSTRAINT "orders_code_key" UNIQUE (code);',
    ],
    [
      'an exclusion constraint',
      makeConstraint(
        ORDERS,
        'orders_no_overlap',
        'exclusion',
        'EXCLUDE USING gist (room_id WITH =, during WITH &&)'
      ),
      'ALTER TABLE "orders" ADD CONSTRAINT "orders_no_overlap" EXCLUDE USING gist (room_id WITH =, during WITH &&);',
    ],
    [
      'a constraint whose names need quotes',
      makeConstraint(
        { schema: 'Sink Área', name: 'Order; Lines' },
        'Order; Lines_pkey',
        'primaryKey',
        'PRIMARY KEY ("Id")'
      ),
      'ALTER TABLE "Sink Área"."Order; Lines" ADD CONSTRAINT "Order; Lines_pkey" PRIMARY KEY ("Id");',
    ],
  ])('adds %s with pgm.addConstraint', (_, constraint, expected) => {
    const result = emitAndRun(emitConstraint, constraint);

    expectCode(result);
    expect(result.calls).toStrictEqual(['addConstraint']);
    expectSql(result, expected);
  });

  it.each<[string, Partial<Constraint>, string[], string]>([
    [
      'clusters the table on it',
      { clustered: true },
      ['CLUSTER ON'],
      'ALTER TABLE "kitchen"."order_lines" CLUSTER ON "order_lines_pkey";',
    ],
    [
      'uses it as the replica identity of the table',
      { replicaIdentity: true },
      ['replica identity'],
      'ALTER TABLE "kitchen"."order_lines" REPLICA IDENTITY USING INDEX "order_lines_pkey";',
    ],
    [
      'does both',
      { clustered: true, replicaIdentity: true },
      ['CLUSTER ON', 'replica identity'],
      `ALTER TABLE "kitchen"."order_lines" CLUSTER ON "order_lines_pkey";
       ALTER TABLE "kitchen"."order_lines" REPLICA IDENTITY USING INDEX "order_lines_pkey";`,
    ],
  ])(
    'adds a constraint and alters its table when the table %s',
    (_, fields, reasons, after) => {
      const result = emitAndRun(
        emitConstraint,
        makeConstraint(
          ORDER_LINES,
          'order_lines_pkey',
          'primaryKey',
          'PRIMARY KEY (order_id, line_no)',
          fields
        )
      );

      expectFallback(result, ...reasons);
      expect(result.calls[0]).toBe('addConstraint');
      expectSqlThenAnyOrder(
        result,
        `ALTER TABLE "kitchen"."order_lines" ADD CONSTRAINT "order_lines_pkey" PRIMARY KEY (order_id, line_no);
       ${after}`
      );
    }
  );
});
