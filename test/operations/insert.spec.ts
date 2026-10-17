import { describe, expect, it } from 'vitest';
import type { Insert, Value } from '../../src';
import { insert } from '../../src/operations/insert';
import { PgLiteral } from '../../src/utils';
import { options1, options2 } from '../presetMigrationOptions';

describe('operations', () => {
  describe('insert', () => {
    const insertFn: Insert = insert(options1);

    it('accepts an array containing one record', () => {
      expect(insertFn('names', [{ name: 'Ada' }])).toBe(
        'INSERT INTO "names" ("name") VALUES ($pga$Ada$pga$);'
      );
    });

    it('inserts multiple records in one statement, aligning columns by name', () => {
      expect(
        insertFn('names', [
          { name: 'Ada', active: false },
          { active: true, name: 'Grace' },
        ])
      ).toBe(
        'INSERT INTO "names" ("name", "active") VALUES ($pga$Ada$pga$, false), ($pga$Grace$pga$, true);'
      );
    });

    it('uses the union of columns and DEFAULT for missing or undefined fields', () => {
      expect(
        insertFn('records', [
          { id: 1, omitted: undefined },
          { name: 'Ada', id: undefined },
          {},
          { name: null, id: 4 },
        ])
      ).toBe(
        'INSERT INTO "records" ("id", "name") VALUES (1, DEFAULT), (DEFAULT, $pga$Ada$pga$), (DEFAULT, DEFAULT), (4, NULL);'
      );
    });

    it('does not use inherited properties for missing columns', () => {
      expect(insertFn('records', [{ constructor: 'own' }, {}])).toBe(
        'INSERT INTO "records" ("constructor") VALUES ($pga$own$pga$), (DEFAULT);'
      );
    });

    it('escapes identifiers and values in multiple records', () => {
      expect(
        insertFn({ schema: 'app.schema', name: 'record"表' }, [
          { 'column"name': '$pga$); DROP TABLE records; --', tags: ['ARRAY'] },
          {
            'column"name': PgLiteral.create('CURRENT_TIMESTAMP'),
            tags: ['ebook'],
          },
        ])
      ).toBe(
        'INSERT INTO "app.schema"."record""表" ("column""name", "tags") VALUES ($pgb$$pga$); DROP TABLE records; --$pgb$, ARRAY[$pga$ARRAY$pga$]), (CURRENT_TIMESTAMP, ARRAY[$pga$ebook$pga$]);'
      );
    });

    it('decamelizes identifiers across multiple records', () => {
      expect(
        insert(options2)({ schema: 'appSchema', name: 'mediaTypes' }, [
          { displayName: 'audioBook' },
          { displayName: 'eBook' },
        ])
      ).toBe(
        'INSERT INTO "app_schema"."media_types" ("display_name") VALUES ($pga$audioBook$pga$), ($pga$eBook$pga$);'
      );
    });

    it('inserts every all-default record', () => {
      expect(insertFn('records', [{}, { id: undefined }])).toBe(
        'INSERT INTO "records" DEFAULT VALUES;\nINSERT INTO "records" DEFAULT VALUES;'
      );
    });

    it('returns no statements for an empty array', () => {
      expect(insertFn('records', [])).toEqual([]);
    });

    it('escapes values independently of column names', () => {
      expect(
        insertFn('records', {
          name: "O'Reilly",
          count: 0,
          active: false,
          description: null,
          tags: ['paper', 'ebook'],
          created_at: PgLiteral.create('CURRENT_TIMESTAMP'),
        })
      ).toBe(
        'INSERT INTO "records" ("name", "count", "active", "description", "tags", "created_at") VALUES ($pga$O\'Reilly$pga$, 0, false, NULL, ARRAY[$pga$paper$pga$,$pga$ebook$pga$], CURRENT_TIMESTAMP);'
      );
    });

    it('quotes schema, table, and column names', () => {
      expect(
        insertFn(
          { schema: 'app.schema', name: 'record"表' },
          { 'column"name': 'value' }
        )
      ).toBe(
        'INSERT INTO "app.schema"."record""表" ("column""name") VALUES ($pga$value$pga$);'
      );
    });

    it('decamelizes identifiers but preserves string values', () => {
      expect(
        insert(options2)(
          { schema: 'appSchema', name: 'mediaTypes' },
          { displayName: 'audioBook' }
        )
      ).toBe(
        'INSERT INTO "app_schema"."media_types" ("display_name") VALUES ($pga$audioBook$pga$);'
      );
    });

    it.each([
      ['{name} $1 $$ $& $`', '$pga${name} $1 $$ $& $`$pga$'],
      [
        '$pga$); DROP TABLE records; --',
        '$pgb$$pga$); DROP TABLE records; --$pgb$',
      ],
      ['ends with $pga', '$pgb$ends with $pga$pgb$'],
    ])('preserves SQL-looking text as a single value: %s', (value, literal) => {
      expect(insertFn('records', { value })).toBe(
        `INSERT INTO "records" ("value") VALUES (${literal});`
      );
    });

    it('omits undefined columns, including rows containing only undefined', () => {
      expect(insertFn('records', { id: 1, optional: undefined })).toBe(
        'INSERT INTO "records" ("id") VALUES (1);'
      );
      expect(insertFn('records', { optional: undefined })).toBe(
        'INSERT INTO "records" DEFAULT VALUES;'
      );
    });

    it.each([
      { label: 'object', value: { key: 1 } },
      { label: 'Date', value: new Date(0) },
      { label: 'bigint', value: 10n },
      { label: 'Buffer', value: Buffer.from('x') },
      { label: 'NaN', value: Number.NaN },
      { label: 'Infinity', value: Number.POSITIVE_INFINITY },
      { label: '-Infinity', value: Number.NEGATIVE_INFINITY },
      { label: 'nested undefined', value: [1, [undefined]] },
      { label: 'nested object', value: [{ key: 1 }] },
      { label: 'nested Infinity', value: [[Number.POSITIVE_INFINITY]] },
      // Deliberately preserve a hole to verify it is not skipped by validation.
      // oxlint-disable-next-line unicorn/no-new-array
      { label: 'sparse array', value: new Array(1) },
      { label: 'invalid literal', value: { literal: true, value: 1 } },
    ])('rejects $label with table and column context', ({ value }) => {
      const run = () =>
        insertFn({ schema: 'app', name: 'records' }, { data: value as Value });
      expect(() =>
        insertFn({ schema: 'app', name: 'records' }, [
          { data: 'valid' },
          { data: value as Value },
        ])
      ).toThrow('pgm.insert(): unsupported value for "app"."records"."data"');
      expect(run).toThrow(TypeError);
      expect(run).toThrow(
        'pgm.insert(): unsupported value for "app"."records"."data"'
      );
    });

    it('preserves nested arrays and explicit literal objects', () => {
      expect(
        insertFn('records', {
          matrix: [
            [1, 2],
            [3, 4],
          ],
          empty: PgLiteral.create("'{}'::text[]"),
          expression: { literal: true, value: '1 + 2' },
        })
      ).toBe(
        `INSERT INTO "records" ("matrix", "empty", "expression") VALUES (ARRAY[[1,2],[3,4]], '{}'::text[], 1 + 2);`
      );
    });

    it('uses DEFAULT VALUES for an empty row', () => {
      expect(insertFn('records', {})).toBe(
        'INSERT INTO "records" DEFAULT VALUES;'
      );
    });
  });
});
