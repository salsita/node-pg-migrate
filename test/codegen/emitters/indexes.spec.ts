import { describe, expect, it } from 'vitest';
import { emitIndex } from '../../../src/codegen/emitters/indexes';
import type {
  Index,
  IndexKey,
  IndexKeyBase,
} from '../../../src/introspect/types';
import { makeIndex } from '../../introspect/objects';
import {
  expectCode,
  expectFallback,
  expectSql,
  expectSqlThenAnyOrder,
} from '../expectations';
import { emitAndRun } from '../run';

type IndexFields = Partial<Omit<Index, 'kind'>>;

const CUSTOMERS = { schema: 'kitchen', name: 'customers' };

function key(column: string, fields: Partial<IndexKey> = {}): IndexKey {
  return { column, descending: false, nullsFirst: false, ...fields };
}

function expressionKey(
  expression: string,
  fields: Partial<IndexKeyBase> = {}
): IndexKey {
  return { expression, descending: false, nullsFirst: false, ...fields };
}

describe('emitIndex', () => {
  it.each<[string, Index, string]>([
    [
      'a plain index',
      makeIndex({ schema: 'public', name: 'orders' }, 'orders_customer_idx', {
        keys: [key('customer_id')],
        comment: 'Set by a comment step',
      }),
      'CREATE INDEX "orders_customer_idx" ON "orders" ("customer_id");',
    ],
    [
      'an index with a descending key, included columns and a predicate',
      makeIndex(CUSTOMERS, 'customers_name_idx', {
        keys: [
          key('last_name'),
          key('first_name', { descending: true, nullsFirst: true }),
        ],
        include: ['mood'],
        predicate: '(deleted_at IS NULL)',
      }),
      'CREATE INDEX "customers_name_idx" ON "kitchen"."customers" ("last_name", "first_name" DESC) INCLUDE ("mood") WHERE (deleted_at IS NULL);',
    ],
    [
      'a unique index',
      makeIndex(CUSTOMERS, 'customers_code_idx', {
        unique: true,
        keys: [key('code')],
      }),
      'CREATE UNIQUE INDEX "customers_code_idx" ON "kitchen"."customers" ("code");',
    ],
    [
      'a unique index whose nulls are not distinct',
      makeIndex(CUSTOMERS, 'customers_ref_idx', {
        unique: true,
        nullsNotDistinct: true,
        keys: [key('ref')],
      }),
      'CREATE UNIQUE INDEX "customers_ref_idx" ON "kitchen"."customers" ("ref") NULLS NOT DISTINCT;',
    ],
    [
      'an index on a function call',
      makeIndex(CUSTOMERS, 'customers_email_idx', {
        keys: [expressionKey('lower((email)::text)')],
      }),
      'CREATE INDEX "customers_email_idx" ON "kitchen"."customers" ((lower((email)::text)));',
    ],
    [
      'an index on an operator expression',
      makeIndex(CUSTOMERS, 'customers_type_idx', {
        keys: [expressionKey("(settings ->> 'type'::text)"), key('id')],
      }),
      `CREATE INDEX "customers_type_idx" ON "kitchen"."customers" (((settings ->> 'type'::text)), "id");`,
    ],
    [
      'a gin index',
      makeIndex(CUSTOMERS, 'customers_tags_idx', {
        method: 'gin',
        keys: [key('tags')],
      }),
      'CREATE INDEX "customers_tags_idx" ON "kitchen"."customers" USING gin ("tags");',
    ],
    [
      'a hash index',
      makeIndex(CUSTOMERS, 'customers_status_idx', {
        method: 'hash',
        keys: [key('status')],
      }),
      'CREATE INDEX "customers_status_idx" ON "kitchen"."customers" USING hash ("status");',
    ],
  ])('creates %s with pgm.createIndex', (_, index, expected) => {
    const result = emitAndRun(emitIndex, index);

    expectCode(result);
    expect(result.calls).toStrictEqual(['createIndex']);
    expectSql(result, expected);
  });

  it.each<[string, string[], IndexFields]>([
    [
      'a method createIndex does not take',
      ['index method brin'],
      {
        method: 'brin',
        keys: [key('placed_at')],
        definition:
          'CREATE INDEX t_idx ON kitchen.customers USING brin (placed_at)',
      },
    ],
    [
      'an operator class',
      ['operator class'],
      {
        method: 'gin',
        keys: [key('last_name', { opclass: 'kitchen.gin_trgm_ops' })],
        definition:
          'CREATE INDEX t_idx ON kitchen.customers USING gin (last_name kitchen.gin_trgm_ops)',
      },
    ],
    [
      'a collation',
      ['collation'],
      {
        keys: [key('code', { collation: 'pg_catalog."C"' })],
        definition:
          'CREATE INDEX t_idx ON kitchen.customers USING btree (code COLLATE "C")',
      },
    ],
    [
      'nulls first in ascending order',
      ['nulls order'],
      {
        keys: [key('shipped_at', { nullsFirst: true })],
        definition:
          'CREATE INDEX t_idx ON kitchen.customers USING btree (shipped_at NULLS FIRST)',
      },
    ],
    [
      'nulls last in descending order',
      ['nulls order'],
      {
        keys: [key('shipped_at', { descending: true })],
        definition:
          'CREATE INDEX t_idx ON kitchen.customers USING btree (shipped_at DESC NULLS LAST)',
      },
    ],
    [
      'storage parameters',
      ['storage parameters'],
      {
        keys: [key('product_id')],
        options: ['fillfactor=80'],
        definition:
          "CREATE INDEX t_idx ON kitchen.customers USING btree (product_id) WITH (fillfactor='80')",
      },
    ],
    [
      'several of them',
      ['index method brin', 'storage parameters'],
      {
        method: 'brin',
        keys: [key('placed_at')],
        options: ['pages_per_range=32'],
        definition:
          "CREATE INDEX t_idx ON kitchen.customers USING brin (placed_at) WITH (pages_per_range='32')",
      },
    ],
  ])('falls back to pg_get_indexdef for %s', (_, reasons, fields) => {
    const index = makeIndex(CUSTOMERS, 't_idx', fields);
    const result = emitAndRun(emitIndex, index);

    expectFallback(result, ...reasons);
    expect(result.calls).toStrictEqual(['sql']);
    expectSql(result, index.definition);
  });

  it.each<[string, IndexFields, string, string]>([
    [
      'clusters the table on it',
      { clustered: true },
      'CLUSTER ON',
      'ALTER TABLE "kitchen"."customers" CLUSTER ON "t_idx";',
    ],
    [
      'uses it as its replica identity',
      { unique: true, replicaIdentity: true },
      'replica identity',
      'ALTER TABLE "kitchen"."customers" REPLICA IDENTITY USING INDEX "t_idx";',
    ],
  ])(
    'creates the index, then alters the table that %s',
    (_, fields, reason, after) => {
      const index = makeIndex(CUSTOMERS, 't_idx', {
        keys: [key('id')],
        definition: `CREATE ${fields.unique === true ? 'UNIQUE ' : ''}INDEX t_idx ON kitchen.customers USING btree (id)`,
        ...fields,
      });
      const result = emitAndRun(emitIndex, index);

      expectFallback(result, reason);
      expectSqlThenAnyOrder(
        result,
        `CREATE ${fields.unique === true ? 'UNIQUE ' : ''}INDEX "t_idx" ON "kitchen"."customers" ("id"); ${after}`
      );
    }
  );

  it('sets the statistics target of each expression key that has one by its position, a target of 0 included', () => {
    const result = emitAndRun(
      emitIndex,
      makeIndex(CUSTOMERS, 't_idx', {
        keys: [
          expressionKey('lower(email)', { statisticsTarget: 500 }),
          key('id'),
          expressionKey('upper(code)'),
          expressionKey('length(code)', { statisticsTarget: 0 }),
        ],
      })
    );

    expectFallback(result, 'column settings');
    expect(result.calls).toStrictEqual(['createIndex', 'sql', 'sql']);
    expectSql(
      result,
      `CREATE INDEX "t_idx" ON "kitchen"."customers" ((lower(email)), "id", (upper(code)), (length(code)));
       ALTER INDEX "kitchen"."t_idx" ALTER COLUMN 1 SET STATISTICS 500;
       ALTER INDEX "kitchen"."t_idx" ALTER COLUMN 4 SET STATISTICS 0;`
    );
  });

  it('sets the statistics targets of an index created from its definition after clustering the table on it, and gives the reasons in that order', () => {
    const result = emitAndRun(
      emitIndex,
      makeIndex(CUSTOMERS, 't_idx', {
        keys: [
          key('id'),
          expressionKey('lower(email)', { statisticsTarget: 50 }),
        ],
        options: ['fillfactor=80'],
        definition:
          "CREATE INDEX t_idx ON kitchen.customers USING btree (id, lower(email)) WITH (fillfactor='80')",
        clustered: true,
      })
    );

    expectFallback(
      result,
      'storage parameters',
      'CLUSTER ON',
      'column settings'
    );
    expect(result.calls).toStrictEqual(['sql', 'sql', 'sql']);
    expectSql(
      result,
      `CREATE INDEX t_idx ON kitchen.customers USING btree (id, lower(email)) WITH (fillfactor='80');
       ALTER TABLE "kitchen"."customers" CLUSTER ON "t_idx";
       ALTER INDEX "kitchen"."t_idx" ALTER COLUMN 2 SET STATISTICS 50;`
    );
  });
});
