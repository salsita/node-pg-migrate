import { describe, expect, it } from 'vitest';
import { emitConstraint } from '../../../src/codegen/emitters/constraints';
import { emitIndex } from '../../../src/codegen/emitters/indexes';
import { emitMaterializedView } from '../../../src/codegen/emitters/materializedViews';
import { emitPolicy } from '../../../src/codegen/emitters/policies';
import { emitTrigger } from '../../../src/codegen/emitters/triggers';
import { emitView } from '../../../src/codegen/emitters/views';
import {
  makeConstraint,
  makeIndex,
  makeMaterializedView,
  makePolicy,
  makeTrigger,
  makeView,
} from '../../introspect/objects';
import {
  expectCode,
  expectFallback,
  expectSql,
  expectSqlThenAnyOrder,
} from '../expectations';
import { emitAndRun } from '../run';

// Indexes, views and the objects of a table beyond the frozen specs,
// including the `ON ONLY` of partitioned indexes (CONTRACT-TS.md §11).

const MEASUREMENTS = { schema: 'kitchen', name: 'measurements' };

describe('emitIndex', () => {
  it('leaves out the ONLY that pg_get_indexdef writes for a partitioned table', () => {
    const result = emitAndRun(
      emitIndex,
      makeIndex(MEASUREMENTS, 'Value "idx"', {
        keys: [{ column: 'value', descending: false, nullsFirst: false }],
        options: ['fillfactor=80'],
        definition:
          'CREATE UNIQUE INDEX "Value ""idx""" ON ONLY kitchen.measurements USING btree (value) WITH (fillfactor=\'80\')',
      })
    );

    expectFallback(result, 'storage parameters');
    expect(result.steps).toStrictEqual([
      'CREATE UNIQUE INDEX "Value ""idx""" ON kitchen.measurements USING btree (value) WITH (fillfactor=\'80\');',
    ]);
  });

  it('keeps a definition that is not a plain CREATE INDEX as it is', () => {
    const result = emitAndRun(
      emitIndex,
      makeIndex(MEASUREMENTS, 't_idx', {
        method: 'bloom',
        definition:
          'CREATE INDEX t_idx ON kitchen.measurements USING bloom (value)',
      })
    );

    expectFallback(result, 'index method bloom');
    expect(result.steps).toStrictEqual([
      'CREATE INDEX t_idx ON kitchen.measurements USING bloom (value);',
    ]);
  });

  it('quotes the columns that createIndex would take for expressions, and wraps expressions that look like names', () => {
    const result = emitAndRun(
      emitIndex,
      makeIndex(MEASUREMENTS, 't_idx', {
        keys: [
          { column: 'Measured At', descending: true, nullsFirst: true },
          { column: 'a-b', descending: false, nullsFirst: false },
          { column: 'f(x)', descending: false, nullsFirst: false },
          { expression: 'total', descending: false, nullsFirst: false },
          { expression: '(a + b)', descending: true, nullsFirst: true },
        ],
      })
    );

    expectCode(result);
    // PostgreSQL stores a parenthesized column such as ("a-b") as the plain
    // column, so the index is the same as with "a-b".
    expectSql(
      result,
      'CREATE INDEX "t_idx" ON "kitchen"."measurements" (("Measured At") DESC, ("a-b"), ("f(x)"), (total), (a + b) DESC);'
    );
  });

  it('creates the index, then clusters the table on it and uses it as its replica identity', () => {
    const result = emitAndRun(
      emitIndex,
      makeIndex(MEASUREMENTS, 't_idx', {
        unique: true,
        clustered: true,
        replicaIdentity: true,
        method: 'brin',
        definition:
          'CREATE UNIQUE INDEX t_idx ON kitchen.measurements USING brin (id)',
      })
    );

    expectFallback(
      result,
      'index method brin',
      'CLUSTER ON',
      'replica identity'
    );
    expectSql(
      result,
      `CREATE UNIQUE INDEX t_idx ON kitchen.measurements USING brin (id);
       ALTER TABLE "kitchen"."measurements" CLUSTER ON "t_idx";
       ALTER TABLE "kitchen"."measurements" REPLICA IDENTITY USING INDEX "t_idx";`
    );
  });
});

describe('emitConstraint', () => {
  it('adds a constraint whose definition has a line break with ALTER TABLE, then clusters on it', () => {
    const result = emitAndRun(
      emitConstraint,
      makeConstraint(
        MEASUREMENTS,
        'measurements_note_check',
        'check',
        "CHECK ((note <> 'one\ntwo'::text))",
        { clustered: true }
      )
    );

    expectFallback(result, 'CLUSTER ON', 'line break');
    expect(result.calls).toStrictEqual(['sql', 'sql']);
    expectSql(
      result,
      `ALTER TABLE "kitchen"."measurements" ADD CONSTRAINT "measurements_note_check" CHECK ((note <> 'one\ntwo'::text));
       ALTER TABLE "kitchen"."measurements" CLUSTER ON "measurements_note_check";`
    );
  });
});

describe('emitView', () => {
  it('falls back to CREATE VIEW for an option whose value needs quotes, and sets the column defaults', () => {
    const definition = ' SELECT 1 AS n,\n    2 AS m';
    const result = emitAndRun(
      emitView,
      makeView('kitchen', 'v', definition, {
        checkOption: 'CASCADED',
        options: ['security_barrier=true', 'custom=a b'],
        columns: [{ name: 'n', default: '0' }, { name: 'm' }],
      })
    );

    expectFallback(result, 'view options');
    expect(result.calls).toStrictEqual(['sql', 'sql']);
    expectSql(
      result,
      `CREATE VIEW "kitchen"."v" WITH (security_barrier = true, custom = 'a b') AS ${definition} WITH CASCADED CHECK OPTION;
       ALTER VIEW "kitchen"."v" ALTER COLUMN "n" SET DEFAULT 0;`
    );
  });

  it('writes the options of a view with their stored values', () => {
    const definition = ' SELECT 1 AS n';
    const result = emitAndRun(
      emitView,
      makeView('public', 'v', definition, {
        options: ['security_barrier=false', 'security_invoker=on'],
      })
    );

    expectCode(result);
    expect(result.emitted.code).toContain(
      `options: { security_barrier: false, security_invoker: 'on' }`
    );
    expectSql(
      result,
      `CREATE VIEW "v" WITH (security_barrier = false, security_invoker = on) AS ${definition};`
    );
  });
});

describe('emitMaterializedView', () => {
  it('gives both reasons of a materialized view with storage parameters and an access method', () => {
    const result = emitAndRun(
      emitMaterializedView,
      makeMaterializedView('kitchen', 'mv', ' SELECT 1 AS n', {
        options: ['fillfactor=90'],
        accessMethod: 'columnar',
      })
    );

    expectFallback(result, 'storage parameters', 'access method');
    expectSql(
      result,
      'CREATE MATERIALIZED VIEW "kitchen"."mv" USING columnar WITH (fillfactor = 90) AS SELECT 1 AS n WITH NO DATA;'
    );
  });
});

describe('emitTrigger', () => {
  it('falls back to pg_get_triggerdef for a constraint trigger with a referenced table', () => {
    const trigger = makeTrigger(MEASUREMENTS, 't', {
      constraint: true,
      definition:
        'CREATE CONSTRAINT TRIGGER t AFTER INSERT ON kitchen.measurements FROM kitchen.sensors NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION kitchen.on_change()',
      enabled: 'REPLICA',
    });
    const result = emitAndRun(emitTrigger, trigger);

    expectFallback(result, 'firing mode', 'referenced table');
    expectSqlThenAnyOrder(
      result,
      `${trigger.definition};
       ALTER TABLE "kitchen"."measurements" ENABLE REPLICA TRIGGER "t";`
    );
  });

  it('creates a constraint trigger that has no referenced table with pgm.createTrigger', () => {
    const result = emitAndRun(
      emitTrigger,
      makeTrigger(MEASUREMENTS, 't', {
        constraint: true,
        definition:
          'CREATE CONSTRAINT TRIGGER t AFTER INSERT ON kitchen.measurements NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION kitchen.on_change()',
      })
    );

    expectCode(result);
  });

  it('writes the old transition table of a trigger with its definition', () => {
    const trigger = makeTrigger(MEASUREMENTS, 't', {
      events: ['DELETE'],
      level: 'STATEMENT',
      oldTable: 'gone',
      definition:
        'CREATE TRIGGER t AFTER DELETE ON kitchen.measurements REFERENCING OLD TABLE AS gone FOR EACH STATEMENT EXECUTE FUNCTION kitchen.on_change()',
    });
    const result = emitAndRun(emitTrigger, trigger);

    expectFallback(result, 'transition tables');
    expectSql(result, trigger.definition);
  });
});

describe('emitPolicy', () => {
  it('quotes the roles that need quotes, and keeps PUBLIC', () => {
    const result = emitAndRun(
      emitPolicy,
      makePolicy(MEASUREMENTS, 'p', {
        command: 'UPDATE',
        roles: ['App User', 'PUBLIC', 'user'],
        check: '(value > (0)::double precision)',
      })
    );

    expectCode(result);
    expect(result.emitted.code).toContain(
      `role: ['"App User"', 'PUBLIC', '"user"']`
    );
    expectSql(
      result,
      `CREATE POLICY "p" ON "kitchen"."measurements" FOR UPDATE TO "App User", PUBLIC, "user" WITH CHECK ((value > (0)::double precision));`
    );
  });

  it('writes a restrictive policy for every role without USING', () => {
    const result = emitAndRun(
      emitPolicy,
      makePolicy(MEASUREMENTS, 'p', {
        permissive: false,
        command: 'INSERT',
        check: 'true',
      })
    );

    expectFallback(result, 'restrictive policy');
    expectSql(
      result,
      'CREATE POLICY "p" ON "kitchen"."measurements" AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK (true);'
    );
  });
});
