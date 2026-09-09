import { describe, expect, it, vi } from 'vitest';
import type { PgLiteralValue } from '../../src';
import { MigrationBuilder, PgLiteral } from '../../src';
import type { Name } from '../../src/operations/generalTypes';

const operations = [
  ['renameTable', 'TABLE', 'a table'],
  ['renameType', 'TYPE', 'a type'],
  ['renameDomain', 'DOMAIN', 'a domain'],
  ['renameView', 'VIEW', 'a view'],
  ['renameMaterializedView', 'MATERIALIZED VIEW', 'a materialized view'],
  ['renameSequence', 'SEQUENCE', 'a sequence'],
  ['renameIndex', 'INDEX', 'an index'],
] as const;

const unqualifiedSources: Name[] = [
  'old',
  { name: 'old' },
  { schema: undefined, name: 'old' },
  { schema: '', name: 'old' },
];
const unqualifiedDestinations: Name[] = [
  'new',
  { name: 'new' },
  { schema: undefined, name: 'new' },
  { schema: '', name: 'new' },
];

describe('operations', () => {
  describe.each(operations)('%s schemas', (operation, keyword, label) => {
    describe.each(['up', 'down'] as const)('%s', (direction) => {
      function builder(decamelize = false): MigrationBuilder {
        const pgm = new MigrationBuilder(
          { query: vi.fn(), select: vi.fn() },
          undefined,
          decamelize,
          console
        );
        if (direction === 'down') {
          pgm.enableReverseMode();
        }
        return pgm;
      }

      function rename(source: Name, destination: Name, decamelize = false) {
        const pgm = builder(decamelize);
        pgm[operation](source, destination);
        return pgm.getSqlSteps();
      }

      it('preserves schema and rename-chain order', () => {
        const pgm = builder();
        pgm[operation]({ schema: 'app', name: 'old' }, 'middle');
        pgm[operation](
          { schema: 'app', name: 'middle' },
          { schema: 'app', name: 'new' }
        );
        expect(pgm.getSqlSteps()).toEqual(
          direction === 'down'
            ? [
                `ALTER ${keyword} "app"."new" RENAME TO "middle";`,
                `ALTER ${keyword} "app"."middle" RENAME TO "old";`,
              ]
            : [
                `ALTER ${keyword} "app"."old" RENAME TO "middle";`,
                `ALTER ${keyword} "app"."middle" RENAME TO "new";`,
              ]
        );
      });

      it.each([...unqualifiedDestinations, { schema: 'app', name: 'new' }])(
        'preserves the source schema for destination %j',
        (destination) => {
          expect(rename({ schema: 'app', name: 'old' }, destination)).toEqual([
            direction === 'down'
              ? `ALTER ${keyword} "app"."new" RENAME TO "old";`
              : `ALTER ${keyword} "app"."old" RENAME TO "new";`,
          ]);
        }
      );

      it.each(
        unqualifiedSources.flatMap((source) =>
          unqualifiedDestinations.map((destination) => ({
            source,
            destination,
          }))
        )
      )(
        'normalizes omitted and empty schemas: $source -> $destination',
        ({ source, destination }) => {
          expect(rename(source, destination)).toEqual([
            direction === 'down'
              ? `ALTER ${keyword} "new" RENAME TO "old";`
              : `ALTER ${keyword} "old" RENAME TO "new";`,
          ]);
        }
      );

      it('rejects different explicit schemas', () => {
        const pgm = builder();
        pgm[operation]('existing', 'renamed');
        const before = pgm.getSqlSteps();
        expect(() => {
          pgm[operation](
            { schema: 'app', name: 'old' },
            { schema: 'other', name: 'new' }
          );
        }).toThrow(
          new Error(`${operation} cannot change the schema of ${label}`)
        );
        expect(pgm.getSqlSteps()).toEqual(before);
      });

      it.each([...unqualifiedSources, PgLiteral.create('old')])(
        'explains how to specify the unknown source schema for %j',
        (source) => {
          const pgm = builder();
          pgm[operation]('existing', 'renamed');
          const before = pgm.getSqlSteps();
          expect(() => {
            pgm[operation](source, { schema: 'app', name: 'new' });
          }).toThrow(
            new Error(
              `${operation} cannot infer the source schema; use { schema, name } for the source`
            )
          );
          expect(pgm.getSqlSteps()).toEqual(before);
        }
      );

      it.each([
        ['appSchema', 'app_schema'],
        ['app_schema', 'appSchema'],
        ['appSchema', 'appSchema'],
      ])(
        'compares rendered schemas: %s -> %s',
        (sourceSchema, destinationSchema) => {
          expect(
            rename(
              { schema: sourceSchema, name: 'oldName' },
              { schema: destinationSchema, name: 'newName' },
              true
            )
          ).toEqual([
            direction === 'down'
              ? `ALTER ${keyword} "app_schema"."new_name" RENAME TO "old_name";`
              : `ALTER ${keyword} "app_schema"."old_name" RENAME TO "new_name";`,
          ]);
        }
      );

      it.each([false, true])(
        'rejects schemas that still render differently (decamelize=%s)',
        (decamelize) => {
          expect(() =>
            rename(
              { schema: 'appSchema', name: 'old' },
              {
                schema: decamelize ? 'otherSchema' : 'app_schema',
                name: 'new',
              },
              decamelize
            )
          ).toThrow(
            new Error(`${operation} cannot change the schema of ${label}`)
          );
        }
      );

      it('escapes schema and object identifiers', () => {
        expect(
          rename({ schema: 'my"schema', name: 'old"name' }, 'new"name')
        ).toEqual([
          direction === 'down'
            ? `ALTER ${keyword} "my""schema"."new""name" RENAME TO "old""name";`
            : `ALTER ${keyword} "my""schema"."old""name" RENAME TO "new""name";`,
        ]);
      });

      it.each([
        'rawName',
        '_name$1',
        'ação',
        '名字',
        '🦉',
        '"name.with.dot"',
        '"escaped""quote"',
        '"two words"',
        ' \t"New.Name"\n',
        '"comment--inside"',
      ])(
        'preserves the single raw identifier %j under decamelization',
        (raw) => {
          const literal = PgLiteral.create(raw);
          expect(rename(literal, 'newName', true)).toEqual([
            direction === 'down'
              ? `ALTER ${keyword} "new_name" RENAME TO ${raw};`
              : `ALTER ${keyword} ${raw} RENAME TO "new_name";`,
          ]);
          expect(
            rename({ schema: 'appSchema', name: 'oldName' }, literal, true)
          ).toEqual([
            direction === 'down'
              ? `ALTER ${keyword} "app_schema".${raw} RENAME TO "old_name";`
              : `ALTER ${keyword} "app_schema"."old_name" RENAME TO ${raw};`,
          ]);
        }
      );

      it.each(['source', 'destination'] as const)(
        'validates the rendered %s literal instead of its value property',
        (position) => {
          const literal: PgLiteralValue = {
            literal: true,
            value: 'safe',
            toString: () => 'app.unsafe',
          };
          expect(() =>
            rename(
              position === 'source' ? literal : 'old',
              position === 'destination' ? literal : 'new'
            )
          ).toThrow(
            new Error(
              `${operation} requires a single unqualified identifier for a PgLiteral ${position}; use { schema, name } for schema-qualified names`
            )
          );
        }
      );

      it('accepts a literal-like object with a valid rendered identifier', () => {
        const literal: PgLiteralValue = {
          literal: true,
          value: 'ignored.value',
          toString: () => '"Raw.Name"',
        };
        expect(rename('old', literal)).toEqual([
          direction === 'down'
            ? `ALTER ${keyword} "Raw.Name" RENAME TO "old";`
            : `ALTER ${keyword} "old" RENAME TO "Raw.Name";`,
        ]);
      });

      it.each([
        'app.old',
        '"app"."old"',
        '"app" . old',
        'db.app.old',
        '',
        '""',
        ' \t\n',
        'old new',
        'lower(old)',
        'old /* comment */',
        'old--comment',
        'old; SELECT 1',
        'U&"d\\0061ta"',
        "'old'",
        '1old',
        '"unterminated',
        '"old"suffix',
        '"nul\0name"',
      ])('rejects unsupported raw name %j before adding a SQL step', (raw) => {
        const pgm = builder();
        pgm[operation]('existing', 'renamed');
        const before = pgm.getSqlSteps();
        expect(() => {
          pgm[operation](PgLiteral.create(raw), 'new');
        }).toThrow(
          new Error(
            `${operation} requires a single unqualified identifier for a PgLiteral source; use { schema, name } for schema-qualified names`
          )
        );
        expect(pgm.getSqlSteps()).toEqual(before);
        expect(() => {
          pgm[operation]({ schema: 'app', name: 'old' }, PgLiteral.create(raw));
        }).toThrow(
          new Error(
            `${operation} requires a single unqualified identifier for a PgLiteral destination; use { schema, name } for schema-qualified names`
          )
        );
        expect(pgm.getSqlSteps()).toEqual(before);
      });
    });
  });
});
