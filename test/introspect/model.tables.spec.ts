import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { rowsToModel, TRIGGER_TYPE } from '../../src/introspect/core/model';
import type {
  PolicyRow,
  RuleRow,
  TriggerRow,
} from '../../src/introspect/types';
import {
  columnRow,
  constraintRow,
  emptyRows,
  FACTS,
  indexRow,
  policyRow,
  ruleRow,
  sequenceRow,
  statisticsRow,
  tableRow,
  triggerRow,
  viewRow,
} from './rows';

const BIGINT_IDENTITY = {
  type: 'bigint',
  start: '1',
  increment: '1',
  minValue: '1',
  maxValue: '9223372036854775807',
  cache: '1',
  cycle: false,
};

describe('rowsToModel', () => {
  describe('tables', () => {
    it('decodes the catalog codes of a table', () => {
      const model = rowsToModel(
        emptyRows({
          tables: [
            tableRow(18_001, 'kitchen', 'session_cache', {
              relpersistence: 'u',
              reloptions: ['fillfactor=70', 'autovacuum_enabled=false'],
              relreplident: 'f',
              relrowsecurity: true,
              relforcerowsecurity: true,
              comment: 'Sessions',
            }),
          ],
        }),
        FACTS
      );

      expect(model.tables).toStrictEqual([
        {
          kind: 'table',
          oid: 18_001,
          schema: 'kitchen',
          name: 'session_cache',
          comment: 'Sessions',
          partitioned: false,
          unlogged: true,
          columns: [],
          inherits: [],
          rowLevelSecurity: true,
          forceRowLevelSecurity: true,
          options: ['fillfactor=70', 'autovacuum_enabled=false'],
          replicaIdentity: 'FULL',
        },
      ]);
    });

    it.each([
      ['d', 'DEFAULT'],
      ['n', 'NOTHING'],
      ['f', 'FULL'],
      ['i', 'INDEX'],
    ] as const)('decodes replica identity %s as %s', (code, expected) => {
      const model = rowsToModel(
        emptyRows({
          tables: [tableRow(18_002, 'kitchen', 't', { relreplident: code })],
        }),
        FACTS
      );

      expect(model.tables[0].replicaIdentity).toBe(expected);
    });

    it('keeps only an access method that is not heap', () => {
      const model = rowsToModel(
        emptyRows({
          tables: [
            tableRow(18_003, 'kitchen', 'a_heap'),
            tableRow(18_004, 'kitchen', 'b_columnar', {
              accessMethod: 'columnar',
            }),
            tableRow(18_005, 'kitchen', 'c_partitioned', {
              relkind: 'p',
              partitionKey: 'RANGE (measured_at)',
              accessMethod: null,
            }),
          ],
        }),
        FACTS
      );

      expect(model.tables[0]).not.toHaveProperty('accessMethod');
      expect(model.tables[1]).toHaveProperty('accessMethod', 'columnar');
      expect(model.tables[2]).not.toHaveProperty('accessMethod');
      expect(model.tables[2]).toMatchObject({
        partitioned: true,
        partitionKey: 'RANGE (measured_at)',
      });
    });

    it('makes the one parent of a partition its partitionOf', () => {
      const bound =
        "FOR VALUES FROM ('2025-01-01 00:00:00+00') TO ('2026-01-01 00:00:00+00')";
      const model = rowsToModel(
        emptyRows({
          tables: [
            tableRow(18_010, 'kitchen', 'measurements_2025', {
              relispartition: true,
              relkind: 'p',
              partitionKey: 'HASH (sensor_id)',
              partitionBound: bound,
              inherits: [{ schema: 'kitchen', name: 'measurements' }],
            }),
          ],
        }),
        FACTS
      );

      expect(model.tables[0]).toMatchObject({
        partitioned: true,
        partitionKey: 'HASH (sensor_id)',
        partitionOf: {
          parent: { schema: 'kitchen', name: 'measurements' },
          bound,
        },
        inherits: [],
      });
    });

    it('keeps the parents of an inheritance child in their order', () => {
      const parents = [
        { schema: 'kitchen', name: 'vehicles' },
        { schema: 'kitchen', name: 'assets' },
      ];
      const model = rowsToModel(
        emptyRows({
          tables: [
            tableRow(18_020, 'kitchen', 'trucks', { inherits: parents }),
          ],
        }),
        FACTS
      );

      expect(model.tables[0].inherits).toStrictEqual(parents);
      expect(model.tables[0]).not.toHaveProperty('partitionOf');
    });
  });

  describe('columns', () => {
    it('gives a table its columns in attnum order, with their catalog codes decoded', () => {
      const model = rowsToModel(
        emptyRows({
          tables: [tableRow(18_030, 'kitchen', 'customers')],
          columns: [
            columnRow(18_030, 3, 'area', 'numeric', {
              attgenerated: 'v',
              default: '(width * height)',
              attstorage: 'm',
              typstorage: 'm',
            }),
            columnRow(18_030, 1, 'id', 'bigint', {
              attnotnull: true,
              attidentity: 'a',
              identitySequence: {
                schema: 'kitchen',
                name: 'customers_id_seq',
                ...BIGINT_IDENTITY,
              },
            }),
            columnRow(18_030, 5, 'payload', 'jsonb', {
              attstorage: 'e',
              typstorage: 'x',
              attcompression: 'l',
              attoptions: ['n_distinct=100'],
            }),
            columnRow(18_030, 2, 'full_name', 'text', {
              attgenerated: 's',
              default: "((first_name || ' '::text) || last_name)",
              attstorage: 'x',
              typstorage: 'x',
            }),
            columnRow(18_030, 4, 'code', 'text', {
              collation: 'pg_catalog."C"',
              statisticsTarget: 500,
              comment: 'Customer code',
              attstorage: 'x',
              typstorage: 'x',
            }),
            columnRow(18_030, 7, 'legacy_no', 'integer', {
              attnotnull: true,
              attidentity: 'd',
              identitySequence: {
                schema: 'kitchen',
                name: 'legacy_numbers',
                type: 'integer',
                start: '100',
                increment: '5',
                minValue: '1',
                maxValue: '2147483647',
                cache: '1',
                cycle: false,
              },
            }),
            columnRow(18_030, 6, 'status', 'text', {
              attnotnull: true,
              default: "'new'::text",
              attstorage: 'm',
              typstorage: 'x',
              attcompression: 'p',
            }),
            columnRow(18_030, 8, 'amount', 'numeric', {
              attstorage: 'x',
              typstorage: 'm',
              attislocal: false,
              attinhcount: 2,
            }),
            columnRow(18_030, 9, 'blob', 'bytea', {
              attstorage: 'p',
              typstorage: 'x',
            }),
          ],
        }),
        FACTS
      );

      expect(model.tables[0].columns).toStrictEqual([
        {
          name: 'id',
          type: 'bigint',
          notNull: true,
          identity: {
            generation: 'ALWAYS',
            sequence: { schema: 'kitchen', name: 'customers_id_seq' },
            options: BIGINT_IDENTITY,
          },
          local: true,
          inheritCount: 0,
          options: [],
        },
        {
          name: 'full_name',
          type: 'text',
          notNull: false,
          generated: {
            storage: 'STORED',
            expression: "((first_name || ' '::text) || last_name)",
          },
          local: true,
          inheritCount: 0,
          options: [],
        },
        {
          name: 'area',
          type: 'numeric',
          notNull: false,
          generated: { storage: 'VIRTUAL', expression: '(width * height)' },
          local: true,
          inheritCount: 0,
          options: [],
        },
        {
          name: 'code',
          type: 'text',
          notNull: false,
          collation: 'pg_catalog."C"',
          comment: 'Customer code',
          local: true,
          inheritCount: 0,
          statisticsTarget: 500,
          options: [],
        },
        {
          name: 'payload',
          type: 'jsonb',
          notNull: false,
          local: true,
          inheritCount: 0,
          storage: 'EXTERNAL',
          compression: 'lz4',
          options: ['n_distinct=100'],
        },
        {
          name: 'status',
          type: 'text',
          notNull: true,
          default: "'new'::text",
          local: true,
          inheritCount: 0,
          storage: 'MAIN',
          compression: 'pglz',
          options: [],
        },
        {
          name: 'legacy_no',
          type: 'integer',
          notNull: true,
          identity: {
            generation: 'BY DEFAULT',
            sequence: { schema: 'kitchen', name: 'legacy_numbers' },
            options: {
              type: 'integer',
              start: '100',
              increment: '5',
              minValue: '1',
              maxValue: '2147483647',
              cache: '1',
              cycle: false,
            },
          },
          local: true,
          inheritCount: 0,
          options: [],
        },
        {
          name: 'amount',
          type: 'numeric',
          notNull: false,
          local: false,
          inheritCount: 2,
          storage: 'EXTENDED',
          options: [],
        },
        {
          name: 'blob',
          type: 'bytea',
          notNull: false,
          local: true,
          inheritCount: 0,
          storage: 'PLAIN',
          options: [],
        },
      ]);
    });

    it('gives a column the sequence it owns, when it owns exactly one', () => {
      const model = rowsToModel(
        emptyRows({
          tables: [tableRow(18_040, 'kitchen', 'orders')],
          columns: [
            columnRow(18_040, 1, 'id', 'integer', {
              attnotnull: true,
              default: "nextval('kitchen.orders_id_seq'::regclass)",
            }),
            columnRow(18_040, 2, 'ticket_no', 'bigint', {
              default: "nextval('kitchen.ticket_seq'::regclass)",
            }),
          ],
          sequences: [
            sequenceRow(18_041, 'kitchen', 'orders_id_seq', {
              type: 'integer',
              maxValue: '2147483647',
              relpersistence: 'u',
              ownerSchema: 'kitchen',
              ownerTable: 'orders',
              ownerColumn: 'id',
            }),
            sequenceRow(18_042, 'kitchen', 'ticket_seq', {
              ownerSchema: 'kitchen',
              ownerTable: 'orders',
              ownerColumn: 'ticket_no',
            }),
            sequenceRow(18_043, 'kitchen', 'ticket_seq_old', {
              ownerSchema: 'kitchen',
              ownerTable: 'orders',
              ownerColumn: 'ticket_no',
            }),
          ],
        }),
        FACTS
      );

      const [id, ticketNo] = model.tables[0].columns;
      expect(id.ownedSequence).toStrictEqual({
        name: { schema: 'kitchen', name: 'orders_id_seq' },
        options: {
          type: 'integer',
          start: '1',
          increment: '1',
          minValue: '1',
          maxValue: '2147483647',
          cache: '1',
          cycle: false,
        },
        unlogged: true,
      });
      expect(ticketNo).not.toHaveProperty('ownedSequence');
      expect(model.sequences.map((sequence) => sequence.ownedBy)).toStrictEqual(
        [
          { table: { schema: 'kitchen', name: 'orders' }, column: 'id' },
          { table: { schema: 'kitchen', name: 'orders' }, column: 'ticket_no' },
          { table: { schema: 'kitchen', name: 'orders' }, column: 'ticket_no' },
        ]
      );
    });

    it('folds PostgreSQL 18 NOT NULL constraints into their columns', () => {
      const model = rowsToModel(
        emptyRows({
          tables: [tableRow(18_060, 'kitchen', 'parcels')],
          columns: [
            columnRow(18_060, 1, 'id', 'integer', { attnotnull: true }),
            columnRow(18_060, 2, 'width', 'integer', { attnotnull: true }),
            columnRow(18_060, 3, 'note', 'text'),
          ],
          constraints: [
            constraintRow(
              18_061,
              'kitchen',
              'parcels_id_not_null',
              18_060,
              'n',
              'NOT NULL id',
              { conkey: [1] }
            ),
            constraintRow(
              18_062,
              'kitchen',
              'width_required',
              18_060,
              'n',
              'NOT NULL width NO INHERIT NOT VALID',
              {
                conkey: [2],
                connoinherit: true,
                convalidated: false,
                conislocal: false,
              }
            ),
          ],
        }),
        FACTS
      );

      const [id, width, note] = model.tables[0].columns;
      expect(id.notNullConstraint).toStrictEqual({
        name: 'parcels_id_not_null',
        noInherit: false,
        validated: true,
      });
      expect(width.notNullConstraint).toStrictEqual({
        name: 'width_required',
        noInherit: true,
        validated: false,
      });
      expect(note).not.toHaveProperty('notNullConstraint');
      expect(model.constraints).toStrictEqual([]);
    });
  });

  describe('constraints', () => {
    it('decodes constraints and leaves out the ones a table only inherits', () => {
      const orders = tableRow(18_051, 'kitchen', 'orders');
      const model = rowsToModel(
        emptyRows({
          tables: [tableRow(18_050, 'kitchen', 'order_lines'), orders],
          constraints: [
            constraintRow(
              18_052,
              'kitchen',
              'orders_pkey',
              18_051,
              'p',
              'PRIMARY KEY (id)',
              {
                conkey: [1],
                conindid: 18_053,
                indexClustered: true,
                indexReplicaIdentity: true,
                indexComment: 'The key',
                comment: 'Primary',
              }
            ),
            constraintRow(
              18_054,
              'kitchen',
              'order_lines_order_fkey',
              18_050,
              'f',
              'FOREIGN KEY (order_id) REFERENCES kitchen.orders(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED',
              {
                condeferrable: true,
                condeferred: true,
                conkey: [1],
                conindid: 18_053,
                confrelid: 18_051,
                referencedSchema: 'kitchen',
                referencedTable: 'orders',
              }
            ),
            constraintRow(
              18_055,
              'kitchen',
              'order_lines_quantity_check',
              18_050,
              'c',
              'CHECK ((quantity > 0)) NOT VALID',
              { checkExpression: '(quantity > 0)', convalidated: false }
            ),
            constraintRow(
              18_056,
              'kitchen',
              'order_lines_inherited_check',
              18_050,
              'c',
              'CHECK ((line_no > 0))',
              { checkExpression: '(line_no > 0)', conislocal: false }
            ),
            constraintRow(
              18_057,
              'kitchen',
              'orders_code_key',
              18_051,
              'u',
              'UNIQUE (code)',
              { conindid: 18_058 }
            ),
            constraintRow(
              18_059,
              'kitchen',
              'orders_no_overlap',
              18_051,
              'x',
              'EXCLUDE USING gist (room_id WITH =, during WITH &&)',
              { conindid: 18_060 }
            ),
          ],
        }),
        FACTS
      );

      expect(
        model.constraints.map(({ name, type }) => [name, type])
      ).toStrictEqual([
        ['order_lines_order_fkey', 'foreignKey'],
        ['order_lines_quantity_check', 'check'],
        ['orders_code_key', 'unique'],
        ['orders_no_overlap', 'exclusion'],
        ['orders_pkey', 'primaryKey'],
      ]);
      expect(model.constraints[0]).toStrictEqual({
        kind: 'constraint',
        oid: 18_054,
        schema: 'kitchen',
        name: 'order_lines_order_fkey',
        table: { schema: 'kitchen', name: 'order_lines' },
        type: 'foreignKey',
        definition:
          'FOREIGN KEY (order_id) REFERENCES kitchen.orders(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED',
        deferrable: true,
        deferred: true,
        validated: true,
        references: { schema: 'kitchen', name: 'orders' },
        clustered: false,
        replicaIdentity: false,
      });
      expect(model.constraints[1].validated).toBe(false);
      expect(model.constraints[4]).toStrictEqual({
        kind: 'constraint',
        oid: 18_052,
        schema: 'kitchen',
        name: 'orders_pkey',
        comment: 'Primary',
        table: { schema: 'kitchen', name: 'orders' },
        type: 'primaryKey',
        definition: 'PRIMARY KEY (id)',
        deferrable: false,
        deferred: false,
        validated: true,
        clustered: true,
        replicaIdentity: true,
        indexComment: 'The key',
      });
    });
  });

  it('decodes indexes, their keys and the relation they are on', () => {
    const model = rowsToModel(
      emptyRows({
        tables: [tableRow(18_070, 'kitchen', 'customers')],
        views: [
          viewRow(18_071, 'kitchen', 'customer_totals', ' SELECT 1 AS id;', {
            relkind: 'm',
            accessMethod: 'heap',
          }),
        ],
        indexes: [
          indexRow(18_072, 'kitchen', 'customers_name_idx', 18_070, {
            definition:
              'CREATE INDEX customers_name_idx ON kitchen.customers USING btree (last_name, first_name DESC NULLS LAST) INCLUDE (mood)',
            keys: [
              {
                column: 'last_name',
                expression: null,
                opclass: null,
                collation: null,
                descending: false,
                nullsFirst: false,
              },
              {
                column: 'first_name',
                expression: null,
                opclass: null,
                collation: null,
                descending: true,
                nullsFirst: false,
              },
            ],
            include: ['mood'],
            comment: 'By name',
          }),
          indexRow(18_073, 'kitchen', 'customers_email_idx', 18_070, {
            definition:
              'CREATE UNIQUE INDEX customers_email_idx ON kitchen.customers USING gin (lower((email)::text) COLLATE "C" text_pattern_ops NULLS FIRST) WITH (fillfactor=\'80\') WHERE (email IS NOT NULL)',
            indisunique: true,
            amname: 'gin',
            keys: [
              {
                column: null,
                expression: 'lower((email)::text)',
                opclass: 'pg_catalog.text_pattern_ops',
                collation: 'pg_catalog."C"',
                descending: false,
                nullsFirst: true,
              },
            ],
            predicate: '(email IS NOT NULL)',
            nullsNotDistinct: true,
            reloptions: ['fillfactor=80'],
            indisclustered: true,
            indisreplident: true,
          }),
          indexRow(18_074, 'kitchen', 'customer_totals_id_idx', 18_071),
        ],
      }),
      FACTS
    );

    expect(model.indexes).toStrictEqual([
      {
        kind: 'index',
        oid: 18_074,
        schema: 'kitchen',
        name: 'customer_totals_id_idx',
        table: { schema: 'kitchen', name: 'customer_totals' },
        definition:
          'CREATE INDEX customer_totals_id_idx ON kitchen.t USING btree (id)',
        unique: false,
        method: 'btree',
        keys: [{ column: 'id', descending: false, nullsFirst: false }],
        include: [],
        nullsNotDistinct: false,
        options: [],
        clustered: false,
        replicaIdentity: false,
      },
      {
        kind: 'index',
        oid: 18_073,
        schema: 'kitchen',
        name: 'customers_email_idx',
        table: { schema: 'kitchen', name: 'customers' },
        definition:
          'CREATE UNIQUE INDEX customers_email_idx ON kitchen.customers USING gin (lower((email)::text) COLLATE "C" text_pattern_ops NULLS FIRST) WITH (fillfactor=\'80\') WHERE (email IS NOT NULL)',
        unique: true,
        method: 'gin',
        keys: [
          {
            expression: 'lower((email)::text)',
            opclass: 'pg_catalog.text_pattern_ops',
            collation: 'pg_catalog."C"',
            descending: false,
            nullsFirst: true,
          },
        ],
        include: [],
        predicate: '(email IS NOT NULL)',
        nullsNotDistinct: true,
        options: ['fillfactor=80'],
        clustered: true,
        replicaIdentity: true,
      },
      {
        kind: 'index',
        oid: 18_072,
        schema: 'kitchen',
        name: 'customers_name_idx',
        comment: 'By name',
        table: { schema: 'kitchen', name: 'customers' },
        definition:
          'CREATE INDEX customers_name_idx ON kitchen.customers USING btree (last_name, first_name DESC NULLS LAST) INCLUDE (mood)',
        unique: false,
        method: 'btree',
        keys: [
          { column: 'last_name', descending: false, nullsFirst: false },
          { column: 'first_name', descending: true, nullsFirst: false },
        ],
        include: ['mood'],
        nullsNotDistinct: false,
        options: [],
        clustered: false,
        replicaIdentity: false,
      },
    ]);
  });

  describe('views', () => {
    it('drops only the final ; of a view and splits out its check option', () => {
      const model = rowsToModel(
        emptyRows({
          views: [
            viewRow(
              18_080,
              'kitchen',
              'cheap_products',
              " SELECT id,\n    'a;b'::text AS sku\n   FROM kitchen.products\n  WHERE (price < 10);",
              {
                reloptions: ['check_option=local', 'security_barrier=true'],
                comment: 'Cheap',
              }
            ),
          ],
          columns: [
            columnRow(18_080, 2, 'sku', 'text', {
              comment: 'Stock keeping unit',
              attstorage: 'x',
              typstorage: 'x',
            }),
            columnRow(18_080, 1, 'id', 'integer', { default: '0' }),
          ],
        }),
        FACTS
      );

      expect(model.views).toStrictEqual([
        {
          kind: 'view',
          oid: 18_080,
          schema: 'kitchen',
          name: 'cheap_products',
          comment: 'Cheap',
          definition:
            " SELECT id,\n    'a;b'::text AS sku\n   FROM kitchen.products\n  WHERE (price < 10)",
          checkOption: 'LOCAL',
          options: ['security_barrier=true'],
          columns: [
            { name: 'id', default: '0' },
            { name: 'sku', comment: 'Stock keeping unit' },
          ],
        },
      ]);
    });

    it('decodes a cascaded check option', () => {
      const model = rowsToModel(
        emptyRows({
          views: [
            viewRow(18_081, 'kitchen', 'v', ' SELECT 1 AS one;', {
              reloptions: ['check_option=cascaded'],
            }),
          ],
        }),
        FACTS
      );

      expect(model.views[0]).toMatchObject({
        checkOption: 'CASCADED',
        options: [],
      });
    });

    it('keeps materialized views apart from views', () => {
      const model = rowsToModel(
        emptyRows({
          views: [
            viewRow(18_090, 'kitchen', 'a_totals', ' SELECT 1 AS n;', {
              relkind: 'm',
              reloptions: ['autovacuum_enabled=false'],
              accessMethod: 'heap',
            }),
            viewRow(18_091, 'kitchen', 'b_totals', ' SELECT 2 AS n;', {
              relkind: 'm',
              accessMethod: 'columnar',
              comment: 'Totals',
            }),
          ],
          columns: [
            columnRow(18_090, 1, 'n', 'integer', { comment: 'The number' }),
            columnRow(18_091, 1, 'n', 'integer'),
          ],
        }),
        FACTS
      );

      expect(model.views).toStrictEqual([]);
      expect(model.materializedViews).toStrictEqual([
        {
          kind: 'materializedView',
          oid: 18_090,
          schema: 'kitchen',
          name: 'a_totals',
          definition: ' SELECT 1 AS n',
          options: ['autovacuum_enabled=false'],
          columns: [{ name: 'n', comment: 'The number' }],
        },
        {
          kind: 'materializedView',
          oid: 18_091,
          schema: 'kitchen',
          name: 'b_totals',
          comment: 'Totals',
          definition: ' SELECT 2 AS n',
          options: [],
          accessMethod: 'columnar',
          columns: [{ name: 'n' }],
        },
      ]);
    });
  });

  describe('triggers', () => {
    const { ROW, BEFORE, INSERT, DELETE, UPDATE, TRUNCATE, INSTEAD } =
      TRIGGER_TYPE;

    it.each([
      [ROW | BEFORE | INSERT | UPDATE, 'BEFORE', ['INSERT', 'UPDATE'], 'ROW'],
      [INSERT, 'AFTER', ['INSERT'], 'STATEMENT'],
      [ROW | INSTEAD | INSERT, 'INSTEAD OF', ['INSERT'], 'ROW'],
      [
        ROW | UPDATE | DELETE | INSERT,
        'AFTER',
        ['INSERT', 'DELETE', 'UPDATE'],
        'ROW',
      ],
      [
        BEFORE | TRUNCATE | DELETE,
        'BEFORE',
        ['DELETE', 'TRUNCATE'],
        'STATEMENT',
      ],
    ])('decodes tgtype %i', (tgtype, timing, events, level) => {
      const model = rowsToModel(
        emptyRows({
          tables: [tableRow(18_110, 'kitchen', 'orders')],
          triggers: [
            triggerRow(18_111, 'kitchen', 'orders_trg', 18_110, { tgtype }),
          ],
        }),
        FACTS
      );

      expect(model.triggers[0]).toMatchObject({ timing, events, level });
    });

    it('decodes the arguments, WHEN condition and firing mode of a trigger', () => {
      const definition =
        "CREATE TRIGGER products_touch BEFORE UPDATE OF price, discount_pct ON kitchen.products FOR EACH ROW WHEN ((((old.note)::text IS DISTINCT FROM ')('::text) AND (new.price > (0)::numeric))) EXECUTE FUNCTION kitchen.touch_updated_at('price', 'café', '')";
      const model = rowsToModel(
        emptyRows({
          tables: [tableRow(18_101, 'kitchen', 'products')],
          triggers: [
            triggerRow(18_100, 'kitchen', 'products_touch', 18_101, {
              tgtype: ROW | BEFORE | UPDATE,
              functionName: 'touch_updated_at',
              tgargs: Buffer.from('price\0café\0\0', 'utf8'),
              updateOf: ['price', 'discount_pct'],
              hasCondition: true,
              tgenabled: 'D',
              definition,
              comment: 'Touch',
            }),
          ],
        }),
        FACTS
      );

      expect(model.triggers).toStrictEqual([
        {
          kind: 'trigger',
          oid: 18_100,
          schema: 'kitchen',
          name: 'products_touch',
          comment: 'Touch',
          table: { schema: 'kitchen', name: 'products' },
          timing: 'BEFORE',
          events: ['UPDATE'],
          updateOf: ['price', 'discount_pct'],
          level: 'ROW',
          function: { schema: 'kitchen', name: 'touch_updated_at' },
          args: ['price', 'café', ''],
          condition:
            "(((old.note)::text IS DISTINCT FROM ')('::text) AND (new.price > (0)::numeric))",
          constraint: false,
          deferrable: false,
          deferred: false,
          enabled: 'DISABLED',
          definition,
        },
      ]);
    });

    it.each([
      ['O', 'ORIGIN'],
      ['D', 'DISABLED'],
      ['R', 'REPLICA'],
      ['A', 'ALWAYS'],
    ] as const)('decodes tgenabled %s as %s', (tgenabled, enabled) => {
      const model = rowsToModel(
        emptyRows({
          tables: [tableRow(18_120, 'kitchen', 'orders')],
          triggers: [
            triggerRow(18_121, 'kitchen', 'orders_trg', 18_120, { tgenabled }),
          ],
        }),
        FACTS
      );

      expect(model.triggers[0].enabled).toBe(enabled);
    });

    it('keeps constraint triggers, transition tables and triggers on views', () => {
      const constraintTrigger: TriggerRow = triggerRow(
        18_131,
        'kitchen',
        'order_lines_check',
        18_130,
        {
          isConstraint: true,
          tgdeferrable: true,
          tginitdeferred: true,
        }
      );
      const model = rowsToModel(
        emptyRows({
          tables: [tableRow(18_130, 'kitchen', 'order_lines')],
          views: [viewRow(18_132, 'kitchen', 'order_summary', ' SELECT 1;')],
          triggers: [
            constraintTrigger,
            triggerRow(18_133, 'kitchen', 'order_lines_audit', 18_130, {
              tgtype: TRIGGER_TYPE.INSERT,
              tgoldtable: 'old_rows',
              tgnewtable: 'new_rows',
            }),
            triggerRow(18_134, 'kitchen', 'order_summary_insert', 18_132, {
              tgtype: ROW | INSTEAD | INSERT,
            }),
          ],
        }),
        FACTS
      );

      expect(model.triggers).toMatchObject([
        {
          name: 'order_lines_audit',
          oldTable: 'old_rows',
          newTable: 'new_rows',
        },
        {
          name: 'order_lines_check',
          constraint: true,
          deferrable: true,
          deferred: true,
        },
        {
          name: 'order_summary_insert',
          table: { schema: 'kitchen', name: 'order_summary' },
          timing: 'INSTEAD OF',
        },
      ]);
      expect(model.triggers[1]).not.toHaveProperty('oldTable');
      expect(model.triggers[1]).not.toHaveProperty('condition');
    });
  });

  describe('policies', () => {
    it.each([
      ['*', 'ALL'],
      ['r', 'SELECT'],
      ['a', 'INSERT'],
      ['w', 'UPDATE'],
      ['d', 'DELETE'],
    ] as const)('decodes polcmd %s as %s', (polcmd, command) => {
      const model = rowsToModel(
        emptyRows({
          tables: [tableRow(18_140, 'kitchen', 'documents')],
          policies: [
            policyRow(18_141, 'kitchen', 'documents_p', 18_140, { polcmd }),
          ],
        }),
        FACTS
      );

      expect(model.policies[0].command).toBe(command);
    });

    it('sorts the roles of a policy, PUBLIC included', () => {
      const row: PolicyRow = policyRow(
        18_151,
        'kitchen',
        'documents_owner_delete',
        18_150,
        {
          polcmd: 'd',
          polpermissive: false,
          roles: ['reporting', 'PUBLIC', 'app_user'],
          using: '(owner_name = CURRENT_USER)',
          check: '(tenant_id = kitchen.current_tenant())',
          comment: 'Owners only',
        }
      );
      const model = rowsToModel(
        emptyRows({
          tables: [tableRow(18_150, 'kitchen', 'documents')],
          policies: [row],
        }),
        FACTS
      );

      expect(model.policies).toStrictEqual([
        {
          kind: 'policy',
          oid: 18_151,
          schema: 'kitchen',
          name: 'documents_owner_delete',
          comment: 'Owners only',
          table: { schema: 'kitchen', name: 'documents' },
          command: 'DELETE',
          permissive: false,
          roles: ['PUBLIC', 'app_user', 'reporting'],
          using: '(owner_name = CURRENT_USER)',
          check: '(tenant_id = kitchen.current_tenant())',
        },
      ]);
    });
  });

  it('keeps the whole definition of a rule and decodes its firing mode', () => {
    const definition =
      'CREATE RULE orders_no_delete AS\n    ON DELETE TO kitchen.orders DO INSTEAD NOTHING;';
    const row: RuleRow = ruleRow(
      18_201,
      'kitchen',
      'orders_no_delete',
      18_200,
      definition,
      { enabled: 'R', comment: 'Keep orders' }
    );
    const model = rowsToModel(
      emptyRows({
        tables: [tableRow(18_200, 'kitchen', 'orders')],
        rules: [row],
      }),
      FACTS
    );

    expect(model.rules).toStrictEqual([
      {
        kind: 'rule',
        oid: 18_201,
        schema: 'kitchen',
        name: 'orders_no_delete',
        comment: 'Keep orders',
        table: { schema: 'kitchen', name: 'orders' },
        enabled: 'REPLICA',
        definition,
      },
    ]);
  });

  it('keeps extended statistics and a statistics target that is set', () => {
    const model = rowsToModel(
      emptyRows({
        tables: [tableRow(18_300, 'kitchen', 'orders')],
        statistics: [
          statisticsRow(
            18_301,
            'kitchen',
            'orders_a_stats',
            18_300,
            'CREATE STATISTICS kitchen.orders_a_stats (dependencies) ON customer_id, status FROM kitchen.orders',
            { statisticsTarget: 500 }
          ),
          statisticsRow(
            18_302,
            'kitchen',
            'orders_b_stats',
            18_300,
            'CREATE STATISTICS kitchen.orders_b_stats ON customer_id, placed_at FROM kitchen.orders'
          ),
        ],
      }),
      FACTS
    );

    expect(model.statistics).toStrictEqual([
      {
        kind: 'statistics',
        oid: 18_301,
        schema: 'kitchen',
        name: 'orders_a_stats',
        table: { schema: 'kitchen', name: 'orders' },
        definition:
          'CREATE STATISTICS kitchen.orders_a_stats (dependencies) ON customer_id, status FROM kitchen.orders',
        statisticsTarget: 500,
      },
      {
        kind: 'statistics',
        oid: 18_302,
        schema: 'kitchen',
        name: 'orders_b_stats',
        table: { schema: 'kitchen', name: 'orders' },
        definition:
          'CREATE STATISTICS kitchen.orders_b_stats ON customer_id, placed_at FROM kitchen.orders',
      },
    ]);
  });
});
