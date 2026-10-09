import { describe, expect, it } from 'vitest';
import { emitView } from '../../../src/codegen/emitters/views';
import { makeView } from '../../introspect/objects';
import { expectCode, expectSql, expectSqlOneOf } from '../expectations';
import { emitAndRun } from '../run';

const DEFINITION =
  " SELECT id,\n    full_name\n   FROM kitchen.customers\n  WHERE (mood <> 'sad'::kitchen.mood)";

describe('emitView', () => {
  it('creates a view with pgm.createView and its definition', () => {
    const result = emitAndRun(
      emitView,
      makeView('public', 'active_customers', DEFINITION, {
        comment: 'Set by a comment step',
        columns: [{ name: 'id', comment: 'Set by a comment step' }],
      })
    );

    expectCode(result);
    expect(result.calls).toStrictEqual(['createView']);
    expectSql(result, `CREATE VIEW "active_customers" AS ${DEFINITION};`);
  });

  it.each(['LOCAL', 'CASCADED'] as const)(
    'creates a view WITH %s CHECK OPTION',
    (checkOption) => {
      const result = emitAndRun(
        emitView,
        makeView('kitchen', 'cheap_products', DEFINITION, { checkOption })
      );

      expectCode(result);
      expectSql(
        result,
        `CREATE VIEW "kitchen"."cheap_products" AS ${DEFINITION} WITH ${checkOption} CHECK OPTION;`
      );
    }
  );

  it('creates a view with its options', () => {
    const result = emitAndRun(
      emitView,
      makeView('kitchen', 'secure_customers', DEFINITION, {
        checkOption: 'LOCAL',
        options: ['security_barrier=true'],
      })
    );

    expectCode(result);
    expectSqlOneOf(result, [
      `CREATE VIEW "kitchen"."secure_customers" WITH (security_barrier = true) AS ${DEFINITION} WITH LOCAL CHECK OPTION;`,
      `CREATE VIEW "kitchen"."secure_customers" WITH (security_barrier) AS ${DEFINITION} WITH LOCAL CHECK OPTION;`,
    ]);
  });

  it('sets the column defaults of a view with pgm.alterViewColumn and pgm.func', () => {
    const result = emitAndRun(
      emitView,
      makeView(
        'kitchen',
        'open_orders',
        ' SELECT id,\n    status\n   FROM kitchen.orders',
        {
          columns: [
            { name: 'id' },
            { name: 'status', default: "'open'::text" },
            { name: 'Note', default: "'it''s new'::text" },
          ],
        }
      )
    );

    expectCode(result);
    expect(result.calls).toStrictEqual([
      'createView',
      'alterViewColumn',
      'alterViewColumn',
    ]);
    expect(result.funcs).toStrictEqual(["'open'::text", "'it''s new'::text"]);
    expectSql(
      result,
      `CREATE VIEW "kitchen"."open_orders" AS SELECT id, status FROM kitchen.orders;
       ALTER VIEW "kitchen"."open_orders" ALTER COLUMN "status" SET DEFAULT 'open'::text;
       ALTER VIEW "kitchen"."open_orders" ALTER COLUMN "Note" SET DEFAULT 'it''s new'::text;`
    );
  });

  it('creates a recursive view from its WITH RECURSIVE definition', () => {
    const definition =
      ' WITH RECURSIVE t(n) AS (\n         SELECT 1\n        UNION ALL\n         SELECT (t_1.n + 1)\n           FROM t t_1\n          WHERE (t_1.n < 10)\n        )\n SELECT n\n   FROM t';
    const result = emitAndRun(
      emitView,
      makeView('public', 'numbers', definition)
    );

    expectCode(result);
    expectSql(result, `CREATE VIEW "numbers" AS ${definition};`);
  });
});
