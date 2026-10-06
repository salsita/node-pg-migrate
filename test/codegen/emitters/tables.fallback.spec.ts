import { describe, expect, it } from 'vitest';
import { emitTable } from '../../../src/codegen/emitters/tables';
import type { Column, Table } from '../../../src/introspect/types';
import {
  defaultSequenceOptions,
  makeColumn,
  makeTable,
} from '../../introspect/objects';
import {
  expectFallback,
  expectSql,
  expectSqlOneOf,
  expectSqlThenAnyOrder,
} from '../expectations';
import type { EmitResult } from '../run';
import { emitAndRun } from '../run';

type TableFields = Partial<Omit<Table, 'kind'>>;

const MEASUREMENTS = { schema: 'kitchen', name: 'measurements' };

function inherited(name: string, type: string): Column {
  return makeColumn(name, type, { local: false, inheritCount: 1 });
}

function onlyRawSql(result: EmitResult): void {
  expect(new Set(result.calls)).toStrictEqual(new Set(['sql']));
}

describe('emitTable', () => {
  describe('whole-table fallback', () => {
    it.each<[string, TableFields, string]>([
      [
        'a partition',
        {
          comment: 'Readings of 2025',
          columns: [
            inherited('sensor_id', 'integer'),
            inherited('value', 'double precision'),
          ],
          partitionOf: {
            parent: MEASUREMENTS,
            bound:
              "FOR VALUES FROM ('2025-01-01 00:00:00+00') TO ('2026-01-01 00:00:00+00')",
          },
        },
        `CREATE TABLE "kitchen"."t" PARTITION OF "kitchen"."measurements"
           FOR VALUES FROM ('2025-01-01 00:00:00+00') TO ('2026-01-01 00:00:00+00');
         COMMENT ON TABLE "kitchen"."t" IS 'Readings of 2025';`,
      ],
      [
        'a default partition',
        {
          columns: [inherited('sensor_id', 'integer')],
          partitionOf: { parent: MEASUREMENTS, bound: 'DEFAULT' },
        },
        'CREATE TABLE "kitchen"."t" PARTITION OF "kitchen"."measurements" DEFAULT;',
      ],
      [
        'a partition that is partitioned itself',
        {
          partitioned: true,
          partitionKey: 'HASH (order_id)',
          columns: [
            inherited('region', 'text'),
            inherited('order_id', 'bigint'),
          ],
          partitionOf: {
            parent: { schema: 'kitchen', name: 'orders_by_region' },
            bound: "FOR VALUES IN ('de', 'fr', 'pt')",
          },
        },
        `CREATE TABLE "kitchen"."t" PARTITION OF "kitchen"."orders_by_region"
           FOR VALUES IN ('de', 'fr', 'pt') PARTITION BY HASH (order_id);`,
      ],
    ])('creates %s with CREATE TABLE … PARTITION OF', (_, fields, expected) => {
      const result = emitAndRun(emitTable, makeTable('kitchen', 't', fields));

      expectFallback(result, 'partition');
      onlyRawSql(result);
      expectSqlThenAnyOrder(result, expected);
    });

    it("creates a partition whose columns are not in its partitioned table's order on its own, then attaches it", () => {
      const result = emitAndRun(
        emitTable,
        makeTable('kitchen', 'measurements_2020', {
          partitionOf: {
            parent: MEASUREMENTS,
            bound: "FOR VALUES FROM ('2020-01-01') TO ('2021-01-01')",
            ownColumnOrder: true,
          },
          columns: [
            makeColumn('label', 'text', {
              local: false,
              inheritCount: 1,
              collation: 'pg_catalog."C"',
            }),
            makeColumn('at', 'date', {
              notNull: true,
              local: false,
              inheritCount: 1,
              notNullConstraint: {
                name: 'at_required',
                noInherit: false,
                validated: true,
              },
            }),
            makeColumn('value', 'numeric', {
              local: false,
              inheritCount: 1,
              default: '0',
            }),
          ],
        })
      );

      expectFallback(result, 'partition');
      onlyRawSql(result);
      expectSql(
        result,
        `CREATE TABLE "kitchen"."measurements_2020" (
           "label" text COLLATE pg_catalog."C",
           "at" date CONSTRAINT "at_required" NOT NULL,
           "value" numeric DEFAULT 0
         );
         ALTER TABLE "kitchen"."measurements" ATTACH PARTITION "kitchen"."measurements_2020"
           FOR VALUES FROM ('2020-01-01') TO ('2021-01-01');`
      );
    });

    it('creates a typed table with CREATE TABLE … OF its type, with the options of its columns', () => {
      const result = emitAndRun(
        emitTable,
        makeTable('kitchen', 'people', {
          ofType: { schema: 'kitchen', name: 'person' },
          comment: 'People',
          columns: [
            makeColumn('name', 'text', { notNull: true, comment: 'Full name' }),
            makeColumn('age', 'integer', { default: '0' }),
            makeColumn('nickname', 'text'),
          ],
        })
      );

      expectFallback(result, 'typed table');
      onlyRawSql(result);
      expectSqlThenAnyOrder(
        result,
        `CREATE TABLE "kitchen"."people" OF "kitchen"."person" (
           "name" WITH OPTIONS NOT NULL,
           "age" WITH OPTIONS DEFAULT 0
         );
         COMMENT ON TABLE "kitchen"."people" IS 'People';
         COMMENT ON COLUMN "kitchen"."people"."name" IS 'Full name';`
      );
    });

    it('gives a typed table its other reasons, and none of those of createTable', () => {
      // An object would put the column "1" first: a reason for createTable,
      // which a typed table does not use.
      const result = emitAndRun(
        emitTable,
        makeTable('kitchen', 'people', {
          ofType: { schema: 'kitchen', name: 'person' },
          unlogged: true,
          options: ['fillfactor=70'],
          columns: [makeColumn('age', 'integer'), makeColumn('1', 'text')],
        })
      );

      expectFallback(result, 'typed table', 'storage parameters');
      onlyRawSql(result);
      expectSql(
        result,
        'CREATE UNLOGGED TABLE "kitchen"."people" OF "kitchen"."person" WITH (fillfactor=70);'
      );
    });

    it('keeps the order of the columns around a virtual generated column', () => {
      const result = emitAndRun(
        emitTable,
        makeTable('kitchen', 'parcels', {
          comment: 'Parcels',
          columns: [
            makeColumn('id', 'integer'),
            makeColumn('width', 'numeric'),
            makeColumn('area', 'numeric', {
              generated: { storage: 'VIRTUAL', expression: '(width * height)' },
              comment: 'Virtual (PostgreSQL 18+)',
            }),
            makeColumn('height', 'numeric'),
          ],
        })
      );

      expectFallback(result, 'virtual generated column');
      onlyRawSql(result);
      expectSqlThenAnyOrder(
        result,
        `CREATE TABLE "kitchen"."parcels" (
           "id" integer,
           "width" numeric,
           "area" numeric GENERATED ALWAYS AS ((width * height)) VIRTUAL,
           "height" numeric
         );
         COMMENT ON TABLE "kitchen"."parcels" IS 'Parcels';
         COMMENT ON COLUMN "kitchen"."parcels"."area" IS 'Virtual (PostgreSQL 18+)';`
      );
    });

    it.each<[string, string, TableFields, string]>([
      [
        'storage parameters',
        'storage parameters',
        {
          unlogged: true,
          options: ['fillfactor=70', 'autovacuum_enabled=false'],
          columns: [makeColumn('key', 'text'), makeColumn('value', 'jsonb')],
        },
        `CREATE UNLOGGED TABLE "kitchen"."t" ("key" text, "value" jsonb)
           WITH (fillfactor=70, autovacuum_enabled=false);`,
      ],
      [
        'TOAST storage parameters',
        'storage parameters',
        {
          options: [
            'toast.autovacuum_enabled=false',
            'toast.autovacuum_vacuum_scale_factor=0.2',
          ],
          columns: [makeColumn('id', 'integer'), makeColumn('doc', 'text')],
        },
        `CREATE TABLE "kitchen"."t" ("id" integer, "doc" text)
           WITH (toast.autovacuum_enabled='false', toast.autovacuum_vacuum_scale_factor='0.2');`,
      ],
      [
        'a table access method',
        'access method',
        { accessMethod: 'columnar', columns: [makeColumn('id', 'integer')] },
        'CREATE TABLE "kitchen"."t" ("id" integer) USING columnar;',
      ],
      [
        'several parents',
        'multiple inheritance',
        {
          inherits: [
            { schema: 'kitchen', name: 'vehicles' },
            { schema: 'kitchen', name: 'assets' },
          ],
          columns: [
            makeColumn('id', 'integer', { local: false, inheritCount: 2 }),
            makeColumn('wheels', 'integer'),
          ],
        },
        'CREATE TABLE "kitchen"."t" ("wheels" integer) INHERITS ("kitchen"."vehicles", "kitchen"."assets");',
      ],
      [
        'an identity sequence with another name',
        'identity sequence name',
        {
          columns: [
            makeColumn('id', 'integer', {
              notNull: true,
              identity: {
                generation: 'ALWAYS',
                sequence: { schema: 'kitchen', name: 'ticket_numbers' },
                options: defaultSequenceOptions('integer', { start: '10' }),
              },
            }),
            makeColumn('note', 'text'),
          ],
        },
        `CREATE TABLE "kitchen"."t" (
           "id" integer GENERATED ALWAYS AS IDENTITY (SEQUENCE NAME "kitchen"."ticket_numbers" START WITH 10),
           "note" text
         );`,
      ],
      [
        'a NOT NULL constraint with another name',
        'NOT NULL constraint name',
        {
          columns: [
            makeColumn('width', 'integer', {
              notNull: true,
              notNullConstraint: {
                name: 'width_required',
                noInherit: false,
                validated: true,
              },
            }),
          ],
        },
        'CREATE TABLE "kitchen"."t" ("width" integer CONSTRAINT "width_required" NOT NULL);',
      ],
      [
        'a statistics target',
        'column settings',
        {
          columns: [
            makeColumn('id', 'integer'),
            makeColumn('email', 'text', { statisticsTarget: 500 }),
          ],
        },
        `CREATE TABLE "kitchen"."t" ("id" integer, "email" text);
         ALTER TABLE "kitchen"."t" ALTER COLUMN "email" SET STATISTICS 500;`,
      ],
      [
        'a storage',
        'column settings',
        {
          columns: [makeColumn('value', 'jsonb', { storage: 'EXTERNAL' })],
        },
        `CREATE TABLE "kitchen"."t" ("value" jsonb);
         ALTER TABLE "kitchen"."t" ALTER COLUMN "value" SET STORAGE EXTERNAL;`,
      ],
      [
        'column options',
        'column settings',
        {
          columns: [
            makeColumn('email', 'text', { options: ['n_distinct=100'] }),
          ],
        },
        `CREATE TABLE "kitchen"."t" ("email" text);
         ALTER TABLE "kitchen"."t" ALTER COLUMN "email" SET (n_distinct=100);`,
      ],
      [
        'a full replica identity',
        'replica identity',
        { replicaIdentity: 'FULL', columns: [makeColumn('id', 'integer')] },
        `CREATE TABLE "kitchen"."t" ("id" integer);
         ALTER TABLE "kitchen"."t" REPLICA IDENTITY FULL;`,
      ],
      [
        'no replica identity',
        'replica identity',
        { replicaIdentity: 'NOTHING', columns: [makeColumn('id', 'integer')] },
        `CREATE TABLE "kitchen"."t" ("id" integer);
         ALTER TABLE "kitchen"."t" REPLICA IDENTITY NOTHING;`,
      ],
    ])(
      'creates a table with %s with CREATE TABLE',
      (_, reason, fields, expected) => {
        const result = emitAndRun(emitTable, makeTable('kitchen', 't', fields));

        expectFallback(result, reason);
        onlyRawSql(result);
        expectSqlThenAnyOrder(result, expected);
      }
    );

    it('creates a table with a column compression with CREATE TABLE', () => {
      const result = emitAndRun(
        emitTable,
        makeTable('kitchen', 't', {
          columns: [
            makeColumn('id', 'integer'),
            makeColumn('doc', 'text', { compression: 'lz4' }),
          ],
        })
      );

      expectFallback(result, 'column settings');
      onlyRawSql(result);
      expectSqlOneOf(result, [
        'CREATE TABLE "kitchen"."t" ("id" integer, "doc" text COMPRESSION lz4);',
        `CREATE TABLE "kitchen"."t" ("id" integer, "doc" text);
         ALTER TABLE "kitchen"."t" ALTER COLUMN "doc" SET COMPRESSION lz4;`,
      ]);
    });

    it('gives every reason when there are several', () => {
      const result = emitAndRun(
        emitTable,
        makeTable('kitchen', 't', {
          options: ['fillfactor=70'],
          columns: [inherited('n', 'integer')],
          partitionOf: {
            parent: MEASUREMENTS,
            bound: 'FOR VALUES FROM (1) TO (10)',
          },
        })
      );

      expectFallback(result, 'partition', 'storage parameters');
      expectSqlThenAnyOrder(
        result,
        `CREATE TABLE "kitchen"."t" PARTITION OF "kitchen"."measurements"
           FOR VALUES FROM (1) TO (10) WITH (fillfactor=70);`
      );
    });
  });
});
