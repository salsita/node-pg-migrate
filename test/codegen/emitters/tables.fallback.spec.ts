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
