import { describe, expect, it } from 'vitest';
import type { Insert } from '../../src';
import { insert } from '../../src/operations/insert';
import { PgLiteral } from '../../src/utils';
import { options1, options2 } from '../presetMigrationOptions';

describe('operations', () => {
  describe('insert', () => {
    const insertFn: Insert = insert(options1);

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

    it('uses DEFAULT VALUES for an empty row', () => {
      expect(insertFn('records', {})).toBe(
        'INSERT INTO "records" DEFAULT VALUES;'
      );
    });
  });
});
