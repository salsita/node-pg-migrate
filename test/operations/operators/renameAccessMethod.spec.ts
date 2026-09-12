import { describe, expect, it, vi } from 'vitest';
import { MigrationBuilder, PgLiteral } from '../../../src';
import {
  renameOperatorClass,
  renameOperatorFamily,
} from '../../../src/operations/operators';
import { options2 } from '../../presetMigrationOptions';

const operations = [
  {
    operation: 'renameOperatorClass',
    keyword: 'OPERATOR CLASS',
    create: renameOperatorClass,
  },
  {
    operation: 'renameOperatorFamily',
    keyword: 'OPERATOR FAMILY',
    create: renameOperatorFamily,
  },
] as const;

const invalidMethods: unknown[] = [
  undefined,
  null,
  42,
  true,
  {},
  { name: 'btree' },
  PgLiteral.create('btree'),
  Symbol('btree'),
  {
    toString() {
      throw new Error('Must not coerce an access method');
    },
  },
  '',
  ' \t\n',
  '""',
  'app.btree',
  '"app"."btree"',
  'btree hash',
  'btree /* comment */',
  'btree--comment',
  'btree RENAME TO pwned; --',
  '"nul\0method"',
  'U&"btree"',
  '"unterminated',
  '1btree',
  '"btree"tail',
];

describe.each(operations)(
  '$operation access methods',
  ({ operation, keyword, create }) => {
    describe.each(['up', 'down'] as const)('%s', (direction) => {
      const source = { schema: 'appSchema', name: 'oldName' };
      const destination = { schema: 'app_schema', name: 'newName' };
      const rename = create(options2);
      const fn = direction === 'down' ? rename.reverse : rename;

      it.each([
        'btree',
        'hash',
        'customMethod',
        '"Custom.Method"',
        '"escaped""quote"',
        '"comment--inside"',
        'ação',
        '名字',
        ' \tBTREE\n',
      ])(
        'preserves the single identifier %j without decamelization',
        (method) => {
          expect(fn(source, method, destination)).toBe(
            direction === 'down'
              ? `ALTER ${keyword} "app_schema"."new_name" USING ${method} RENAME TO "old_name";`
              : `ALTER ${keyword} "app_schema"."old_name" USING ${method} RENAME TO "new_name";`
          );
        }
      );

      it.each(invalidMethods)('rejects %j before adding SQL', (method) => {
        const error = new Error(
          `${operation} requires indexMethod to be a string containing a single unqualified identifier`
        );
        expect(() =>
          Reflect.apply(fn, undefined, [source, method, destination])
        ).toThrow(error);

        const pgm = new MigrationBuilder(
          { query: vi.fn(), select: vi.fn() },
          undefined,
          true,
          console
        );
        if (direction === 'down') {
          pgm.enableReverseMode();
        }
        pgm[operation]('existing', 'btree', 'renamed');
        const before = pgm.getSqlSteps();
        expect(() =>
          Reflect.apply(pgm[operation], pgm, [source, method, destination])
        ).toThrow(error);
        expect(pgm.getSqlSteps()).toEqual(before);
      });
    });
  }
);
