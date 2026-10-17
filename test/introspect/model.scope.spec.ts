import { describe, expect, it } from 'vitest';
import { rowsToModel } from '../../src/introspect/core/model';
import type { CatalogRows, SchemaModel } from '../../src/introspect/types';
import {
  castRow,
  columnRow,
  constraintRow,
  dependencyRow,
  emptyRows,
  enumRow,
  extensionRow,
  FACTS,
  functionRow,
  indexRow,
  policyRow,
  ruleRow,
  schemaRow,
  sequenceRow,
  statisticsRow,
  tableRow,
  triggerRow,
  unsupportedRow,
  viewRow,
} from './rows';

/**
 * A schema `audit` with one object of every kind that belongs to a schema,
 * and objects in `kitchen` and `staging` that refer to it.
 */
function threeSchemas(): CatalogRows {
  return emptyRows({
    schemas: [
      schemaRow(19_000, 'kitchen'),
      schemaRow(19_001, 'audit'),
      schemaRow(19_002, 'staging'),
      schemaRow(2200, 'public', 'Kept only when included'),
    ],
    extensions: [extensionRow(19_003, 'audit', 'pgcrypto')],
    enums: [enumRow(19_004, 'audit', 'level', ['low', 'high'])],
    sequences: [sequenceRow(19_005, 'audit', 'events_seq')],
    functions: [functionRow(19_006, 'audit', 'log_event')],
    casts: [castRow(19_007, 'audit.level', 'text')],
    tables: [
      tableRow(19_010, 'kitchen', 'orders'),
      tableRow(19_011, 'audit', 'events'),
      tableRow(19_012, 'staging', 'imports'),
    ],
    columns: [
      columnRow(19_010, 1, 'id', 'integer'),
      columnRow(19_011, 1, 'id', 'integer'),
      columnRow(19_012, 1, 'id', 'integer'),
    ],
    constraints: [
      constraintRow(
        19_013,
        'audit',
        'events_pkey',
        19_011,
        'p',
        'PRIMARY KEY (id)'
      ),
    ],
    indexes: [indexRow(19_014, 'audit', 'events_idx', 19_011)],
    triggers: [triggerRow(19_015, 'audit', 'events_trg', 19_011)],
    policies: [policyRow(19_016, 'audit', 'events_policy', 19_011)],
    rules: [
      ruleRow(
        19_017,
        'audit',
        'events_rule',
        19_011,
        'CREATE RULE events_rule AS\n    ON DELETE TO audit.events DO INSTEAD NOTHING;'
      ),
    ],
    statistics: [
      statisticsRow(
        19_018,
        'audit',
        'events_stats',
        19_011,
        'CREATE STATISTICS audit.events_stats ON id, id FROM audit.events'
      ),
    ],
    dependencies: [
      dependencyRow('pg_class', 19_010, 'pg_proc', 19_006),
      dependencyRow('pg_class', 19_012, 'pg_class', 19_010),
    ],
    unsupported: [
      unsupportedRow(
        'text search configuration',
        'audit',
        'audit.english_nostop'
      ),
      unsupportedRow('language', null, 'plperl'),
    ],
  });
}

function names(
  objects: ReadonlyArray<{ schema: string; name: string }>
): string[] {
  return objects.map(({ schema, name }) => `${schema}.${name}`);
}

function everyName(model: SchemaModel): string[] {
  return [
    ...names(model.schemas),
    ...names(model.extensions),
    ...names(model.enums),
    ...names(model.sequences),
    ...names(model.functions),
    ...names(model.tables),
    ...names(model.constraints),
    ...names(model.indexes),
    ...names(model.triggers),
    ...names(model.policies),
    ...names(model.rules),
    ...names(model.statistics),
  ];
}

describe('rowsToModel', () => {
  describe('scope', () => {
    it('leaves out excluded schemas with everything in them, but not extensions, casts and objects without a schema', () => {
      const model = rowsToModel(threeSchemas(), {
        ...FACTS,
        excludeSchemas: ['audit'],
      });

      expect(everyName(model)).toStrictEqual([
        'kitchen.kitchen',
        'public.public',
        'staging.staging',
        'audit.pgcrypto',
        'kitchen.orders',
        'staging.imports',
      ]);
      expect(model.casts.map(({ source }) => source)).toStrictEqual([
        'audit.level',
      ]);
      expect(model.unsupported).toStrictEqual([
        { kind: 'language', identity: 'plperl' },
      ]);
      expect(model.dependencies).toStrictEqual([
        {
          from: { kind: 'table', oid: 19_012 },
          to: { kind: 'table', oid: 19_010 },
        },
      ]);
    });

    it('keeps only the included schemas, and no casts', () => {
      const model = rowsToModel(threeSchemas(), {
        ...FACTS,
        includeSchemas: ['kitchen'],
      });

      expect(everyName(model)).toStrictEqual([
        'kitchen.kitchen',
        'audit.pgcrypto',
        'kitchen.orders',
      ]);
      expect(model.casts).toStrictEqual([]);
      expect(model.unsupported).toStrictEqual([
        { kind: 'language', identity: 'plperl' },
      ]);
      expect(model.dependencies).toStrictEqual([]);
    });
  });

  describe('the migrations table', () => {
    it('leaves out the migrations table with everything that belongs to it', () => {
      const model = rowsToModel(
        emptyRows({
          tables: [
            tableRow(19_100, 'public', 'pgmigrations'),
            tableRow(19_101, 'app', 'pgmigrations'),
            tableRow(19_102, 'public', 'PgMigrations'),
          ],
          columns: [
            columnRow(19_100, 1, 'id', 'integer', {
              default: "nextval('public.pgmigrations_id_seq'::regclass)",
            }),
            columnRow(19_100, 2, 'name', 'character varying(255)'),
            columnRow(19_101, 1, 'id', 'integer'),
            columnRow(19_102, 1, 'id', 'integer'),
          ],
          sequences: [
            sequenceRow(19_103, 'public', 'pgmigrations_id_seq', {
              ownerSchema: 'public',
              ownerTable: 'pgmigrations',
              ownerColumn: 'id',
            }),
            sequenceRow(19_104, 'public', 'pgmigrations_names', {
              ownerSchema: 'public',
              ownerTable: 'pgmigrations',
              ownerColumn: 'name',
            }),
          ],
          constraints: [
            constraintRow(
              19_105,
              'public',
              'pgmigrations_pkey',
              19_100,
              'p',
              'PRIMARY KEY (id)'
            ),
          ],
          indexes: [
            indexRow(19_106, 'public', 'pgmigrations_name_idx', 19_100),
          ],
          triggers: [triggerRow(19_107, 'public', 'pgmigrations_trg', 19_100)],
          policies: [
            policyRow(19_108, 'public', 'pgmigrations_policy', 19_100),
          ],
          rules: [
            ruleRow(
              19_109,
              'public',
              'pgmigrations_rule',
              19_100,
              'CREATE RULE pgmigrations_rule AS\n    ON DELETE TO public.pgmigrations DO INSTEAD NOTHING;'
            ),
          ],
          statistics: [
            statisticsRow(
              19_110,
              'public',
              'pgmigrations_stats',
              19_100,
              'CREATE STATISTICS public.pgmigrations_stats ON id, name FROM public.pgmigrations'
            ),
          ],
          dependencies: [
            dependencyRow('pg_class', 19_100, 'pg_class', 19_103),
            dependencyRow('pg_class', 19_101, 'pg_class', 19_100),
          ],
        }),
        FACTS
      );

      expect(everyName(model)).toStrictEqual([
        'app.pgmigrations',
        'public.PgMigrations',
      ]);
      expect(model.dependencies).toStrictEqual([]);
    });

    it('leaves out the migrations sequence even when the table does not exist', () => {
      const model = rowsToModel(
        emptyRows({
          sequences: [
            sequenceRow(19_120, 'public', 'pgmigrations_id_seq'),
            sequenceRow(19_121, 'public', 'invoice_seq'),
          ],
        }),
        FACTS
      );

      expect(names(model.sequences)).toStrictEqual(['public.invoice_seq']);
    });

    it('uses the migrations schema, table and sequence it is given', () => {
      const model = rowsToModel(
        emptyRows({
          tables: [
            tableRow(19_130, 'app', 'migrations'),
            tableRow(19_131, 'public', 'migrations'),
          ],
          sequences: [
            sequenceRow(19_132, 'app', 'migration_ids'),
            sequenceRow(19_133, 'app', 'migrations_id_seq'),
          ],
        }),
        {
          migrationsSchema: 'app',
          migrationsTable: 'migrations',
          migrationsSequence: { schema: 'app', name: 'migration_ids' },
        }
      );

      expect(names(model.tables)).toStrictEqual(['public.migrations']);
      expect(names(model.sequences)).toStrictEqual(['app.migrations_id_seq']);
    });
  });

  describe('dependencies', () => {
    it('maps the dependency rows to objects of the model by catalog and OID', () => {
      const model = rowsToModel(
        emptyRows({
          schemas: [schemaRow(20_000, 'kitchen')],
          extensions: [extensionRow(20_005, 'kitchen', 'pg_trgm')],
          enums: [enumRow(20_001, 'kitchen', 'status', ['open', 'closed'])],
          tables: [tableRow(20_001, 'kitchen', 'orders')],
          views: [viewRow(20_002, 'kitchen', 'open_orders', ' SELECT 1;')],
          sequences: [
            sequenceRow(20_003, 'kitchen', 'ticket_seq', {
              ownerSchema: 'kitchen',
              ownerTable: 'orders',
              ownerColumn: 'ticket_no',
            }),
          ],
          functions: [functionRow(20_004, 'kitchen', 'order_total')],
          indexes: [indexRow(20_006, 'kitchen', 'orders_note_idx', 20_001)],
          dependencies: [
            dependencyRow('pg_class', 20_001, 'pg_type', 20_001),
            dependencyRow('pg_class', 20_001, 'pg_class', 20_003),
            dependencyRow('pg_class', 20_003, 'pg_class', 20_001, 'a'),
            dependencyRow('pg_class', 20_002, 'pg_class', 20_001),
            dependencyRow('pg_class', 20_002, 'pg_proc', 20_004),
            dependencyRow('pg_class', 20_002, 'pg_class', 20_001),
            dependencyRow('pg_proc', 20_004, 'pg_class', 20_001),
            dependencyRow('pg_class', 20_001, 'pg_namespace', 20_000),
            dependencyRow('pg_class', 20_006, 'pg_extension', 20_005),
            dependencyRow('pg_class', 20_001, 'pg_type', 99_999),
            dependencyRow('pg_class', 20_001, 'pg_class', 20_001),
          ],
        }),
        FACTS
      );

      expect(model.dependencies).toStrictEqual([
        {
          from: { kind: 'function', oid: 20_004 },
          to: { kind: 'table', oid: 20_001 },
        },
        {
          from: { kind: 'index', oid: 20_006 },
          to: { kind: 'extension', oid: 20_005 },
        },
        {
          from: { kind: 'index', oid: 20_006 },
          to: { kind: 'table', oid: 20_001 },
        },
        {
          from: { kind: 'table', oid: 20_001 },
          to: { kind: 'enum', oid: 20_001 },
        },
        {
          from: { kind: 'table', oid: 20_001 },
          to: { kind: 'schema', oid: 20_000 },
        },
        {
          from: { kind: 'table', oid: 20_001 },
          to: { kind: 'sequence', oid: 20_003 },
        },
        {
          from: { kind: 'view', oid: 20_002 },
          to: { kind: 'function', oid: 20_004 },
        },
        {
          from: { kind: 'view', oid: 20_002 },
          to: { kind: 'table', oid: 20_001 },
        },
      ]);
    });

    it('adds the implicit dependencies', () => {
      const model = rowsToModel(
        emptyRows({
          tables: [
            tableRow(20_100, 'kitchen', 'orders'),
            tableRow(20_101, 'kitchen', 'order_lines'),
            tableRow(20_102, 'kitchen', 'measurements', {
              relkind: 'p',
              partitionKey: 'RANGE (measured_at)',
            }),
            tableRow(20_103, 'kitchen', 'measurements_2025', {
              relispartition: true,
              partitionBound:
                "FOR VALUES FROM ('2025-01-01') TO ('2026-01-01')",
              inherits: [{ schema: 'kitchen', name: 'measurements' }],
            }),
            tableRow(20_104, 'kitchen', 'trucks', {
              inherits: [
                { schema: 'kitchen', name: 'vehicles' },
                { schema: 'kitchen', name: 'assets' },
              ],
            }),
            tableRow(20_105, 'kitchen', 'vehicles'),
            tableRow(20_106, 'kitchen', 'assets'),
          ],
          constraints: [
            constraintRow(
              20_110,
              'kitchen',
              'orders_pkey',
              20_100,
              'p',
              'PRIMARY KEY (id)',
              { conindid: 20_111 }
            ),
            constraintRow(
              20_112,
              'kitchen',
              'order_lines_order_fkey',
              20_101,
              'f',
              'FOREIGN KEY (order_id) REFERENCES kitchen.orders(id)',
              {
                conindid: 20_111,
                confrelid: 20_100,
                referencedSchema: 'kitchen',
                referencedTable: 'orders',
              }
            ),
            constraintRow(
              20_113,
              'kitchen',
              'order_lines_check',
              20_101,
              'c',
              'CHECK ((quantity > 0))'
            ),
          ],
          indexes: [indexRow(20_114, 'kitchen', 'orders_placed_idx', 20_100)],
          triggers: [triggerRow(20_115, 'kitchen', 'orders_trg', 20_100)],
          policies: [policyRow(20_116, 'kitchen', 'orders_policy', 20_100)],
          rules: [
            ruleRow(
              20_117,
              'kitchen',
              'orders_rule',
              20_100,
              'CREATE RULE orders_rule AS\n    ON DELETE TO kitchen.orders DO INSTEAD NOTHING;'
            ),
          ],
          statistics: [
            statisticsRow(
              20_118,
              'kitchen',
              'orders_stats',
              20_100,
              'CREATE STATISTICS kitchen.orders_stats ON id, placed_at FROM kitchen.orders'
            ),
          ],
        }),
        FACTS
      );

      const edge = (
        fromKind: string,
        from: number,
        toKind: string,
        to: number
      ): unknown => ({
        from: { kind: fromKind, oid: from },
        to: { kind: toKind, oid: to },
      });
      expect(model.dependencies).toStrictEqual([
        edge('constraint', 20_110, 'table', 20_100),
        edge('constraint', 20_112, 'constraint', 20_110),
        edge('constraint', 20_112, 'table', 20_101),
        edge('constraint', 20_113, 'table', 20_101),
        edge('index', 20_114, 'table', 20_100),
        edge('policy', 20_116, 'table', 20_100),
        edge('rule', 20_117, 'table', 20_100),
        edge('statistics', 20_118, 'table', 20_100),
        edge('table', 20_103, 'table', 20_102),
        edge('table', 20_104, 'table', 20_105),
        edge('table', 20_104, 'table', 20_106),
        edge('trigger', 20_115, 'table', 20_100),
      ]);
    });

    it('sorts dependencies by OID as a number', () => {
      const model = rowsToModel(
        emptyRows({
          tables: [tableRow(5, 'kitchen', 'a'), tableRow(40, 'kitchen', 'b')],
          indexes: [
            indexRow(1000, 'kitchen', 'a_idx', 5),
            indexRow(999, 'kitchen', 'b_idx', 40),
          ],
        }),
        FACTS
      );

      expect(model.dependencies).toStrictEqual([
        { from: { kind: 'index', oid: 999 }, to: { kind: 'table', oid: 40 } },
        { from: { kind: 'index', oid: 1000 }, to: { kind: 'table', oid: 5 } },
      ]);
    });
  });

  it('lists the objects no migration can represent, sorted by kind then identity', () => {
    const model = rowsToModel(
      emptyRows({
        unsupported: [
          unsupportedRow(
            'text search configuration',
            'kitchen',
            'kitchen.english_nostop'
          ),
          unsupportedRow('language', null, 'plperl'),
          unsupportedRow('event trigger', null, 'audit_ddl'),
          unsupportedRow('conversion', 'kitchen', 'kitchen.latin1_to_utf8'),
          unsupportedRow('language', null, 'plpython3u'),
        ],
      }),
      FACTS
    );

    expect(model.unsupported).toStrictEqual([
      { kind: 'conversion', identity: 'kitchen.latin1_to_utf8' },
      { kind: 'event trigger', identity: 'audit_ddl' },
      { kind: 'language', identity: 'plperl' },
      { kind: 'language', identity: 'plpython3u' },
      { kind: 'text search configuration', identity: 'kitchen.english_nostop' },
    ]);
  });

  describe('sorting', () => {
    it('sorts objects by schema, then name, comparing UTF-16 code units', () => {
      const model = rowsToModel(
        emptyRows({
          tables: [
            tableRow(20_200, 'kitchen', 'alpha'),
            tableRow(20_201, 'kitchen', 'éclair'),
            tableRow(20_202, 'kitchen', '_under'),
            tableRow(20_203, 'kitchen', 'Zeta'),
            tableRow(20_204, 'audit', 'b'),
            tableRow(20_205, 'kitchen', 'Alpha'),
            tableRow(20_206, 'Audit', 'accounts'),
          ],
        }),
        FACTS
      );

      expect(names(model.tables)).toStrictEqual([
        'Audit.accounts',
        'audit.b',
        'kitchen.Alpha',
        'kitchen.Zeta',
        'kitchen._under',
        'kitchen.alpha',
        'kitchen.éclair',
      ]);
    });

    it('sorts objects that share a name by their table, then their identity arguments', () => {
      const model = rowsToModel(
        emptyRows({
          tables: [
            tableRow(20_300, 'kitchen', 'b_table'),
            tableRow(20_301, 'kitchen', 'a_table'),
          ],
          triggers: [
            triggerRow(20_302, 'kitchen', 'audit', 20_300),
            triggerRow(20_303, 'kitchen', 'audit', 20_301),
          ],
          functions: [
            functionRow(20_304, 'kitchen', 'f', {
              identityArguments: 'x text',
            }),
            functionRow(20_305, 'kitchen', 'f', {
              identityArguments: 'x integer',
            }),
            functionRow(20_306, 'kitchen', 'f', { identityArguments: '' }),
          ],
        }),
        FACTS
      );

      expect(model.triggers.map(({ oid }) => oid)).toStrictEqual([
        20_303, 20_302,
      ]);
      expect(model.functions.map(({ oid }) => oid)).toStrictEqual([
        20_306, 20_305, 20_304,
      ]);
    });

    it('gives the same model for the same rows in any order', () => {
      const rows = threeSchemas();
      const reversed = Object.fromEntries(
        Object.entries(rows).map(
          ([key, value]: [string, ReadonlyArray<unknown>]) => [
            key,
            value.toReversed(),
          ]
        )
      ) as unknown as CatalogRows;

      expect(rowsToModel(reversed, FACTS)).toStrictEqual(
        rowsToModel(rows, FACTS)
      );
    });
  });
});
