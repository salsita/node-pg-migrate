import { describe, expect, it } from 'vitest';
import { emitTable } from '../../../src/codegen/emitters/tables';
import type {
  Column,
  ColumnInheritance,
  NotNullConstraint,
  Table,
} from '../../../src/introspect/types';
import { makeColumn, makeTable } from '../../introspect/objects';
import {
  expectCode,
  expectFallback,
  expectSql,
  expectSqlOneOf,
} from '../expectations';
import { emitAndRun } from '../run';

// `CREATE TABLE … INHERITS` and `… PARTITION OF` give the columns of a child
// the defaults and NOT NULL of its parents' columns: a child that has other
// ones gets them right after the table.

const VEHICLES = { schema: 'kitchen', name: 'vehicles' };

/**
 * A column that the table only inherits.
 */
function inherited(
  name: string,
  inheritance: ColumnInheritance,
  fields: Partial<Column> = {}
): Column {
  return makeColumn(name, 'integer', {
    local: false,
    inheritCount: 1,
    inheritance,
    ...fields,
  });
}

/**
 * A PostgreSQL 18 NOT NULL constraint.
 */
function notNull(
  name: string,
  fields: Partial<NotNullConstraint> = {}
): NotNullConstraint {
  return { name, noInherit: false, validated: true, ...fields };
}

/**
 * `kitchen.trucks`, a child of `kitchen.vehicles` with these inherited
 * columns and a `payload_kg` column of its own.
 */
function trucks(columns: Column[], fields: Partial<Table> = {}): Table {
  return makeTable('kitchen', 'trucks', {
    inherits: [VEHICLES],
    columns: [...columns, makeColumn('payload_kg', 'integer')],
    ...fields,
  });
}

const CREATE_TRUCKS =
  'CREATE TABLE "kitchen"."trucks" ("payload_kg" integer) INHERITS ("kitchen"."vehicles");';

describe('emitTable', () => {
  describe('columns an inheritance child inherits', () => {
    it.each<[string, Column, string]>([
      [
        'sets the default a child has instead of its parent one',
        inherited(
          'wheels',
          { parentDefault: '4', parentNotNull: false },
          {
            default: '6',
          }
        ),
        'ALTER TABLE "kitchen"."trucks" ALTER "wheels" SET DEFAULT 6;',
      ],
      [
        'drops the parent default a child does not have',
        inherited('wheels', { parentDefault: '4', parentNotNull: false }),
        'ALTER TABLE "kitchen"."trucks" ALTER "wheels" DROP DEFAULT;',
      ],
      [
        'sets a default where the parent has none',
        inherited(
          'registered_on',
          { parentNotNull: false },
          {
            type: 'date',
            default: 'CURRENT_DATE',
          }
        ),
        'ALTER TABLE "kitchen"."trucks" ALTER "registered_on" SET DEFAULT CURRENT_DATE;',
      ],
      [
        'sets the NOT NULL a child adds (before PostgreSQL 18)',
        inherited('plate', { parentNotNull: false }, { notNull: true }),
        'ALTER TABLE "kitchen"."trucks" ALTER "plate" SET NOT NULL;',
      ],
      [
        'sets the NOT NULL a child adds with the name SET NOT NULL gives it (PostgreSQL 18)',
        inherited(
          'plate',
          { parentNotNull: false, localNotNull: true },
          { notNull: true, notNullConstraint: notNull('trucks_plate_not_null') }
        ),
        'ALTER TABLE "kitchen"."trucks" ALTER "plate" SET NOT NULL;',
      ],
      [
        'declares again an inherited NOT NULL that the child declares itself (PostgreSQL 18)',
        inherited(
          'wheels',
          { parentNotNull: true, localNotNull: true },
          {
            notNull: true,
            notNullConstraint: notNull('vehicles_wheels_not_null'),
          }
        ),
        'ALTER TABLE "kitchen"."trucks" ALTER "wheels" SET NOT NULL;',
      ],
      [
        'sets a default and NOT NULL in one call',
        inherited(
          'plate',
          { parentNotNull: false },
          {
            notNull: true,
            default: "'none'::text",
          }
        ),
        `ALTER TABLE "kitchen"."trucks" ALTER "plate" SET DEFAULT 'none'::text, ALTER "plate" SET NOT NULL;`,
      ],
    ])('%s with alterColumn', (_, column, alter) => {
      const result = emitAndRun(emitTable, trucks([column]));

      expectCode(result);
      expect(result.calls).toStrictEqual(['createTable', 'alterColumn']);
      expectSql(result, `${CREATE_TRUCKS}\n${alter}`);
    });

    it.each<[string, NotNullConstraint, string]>([
      [
        'another name than SET NOT NULL gives',
        notNull('plate_required'),
        'NOT NULL "plate"',
      ],
      [
        'NO INHERIT and NOT VALID',
        notNull('trucks_plate_not_null', { noInherit: true, validated: false }),
        'NOT NULL "plate" NO INHERIT NOT VALID',
      ],
    ])(
      'adds a PostgreSQL 18 NOT NULL constraint with %s with addConstraint',
      (_, constraint, definition) => {
        const result = emitAndRun(
          emitTable,
          trucks([
            inherited(
              'plate',
              { parentNotNull: false, localNotNull: true },
              { notNull: true, notNullConstraint: constraint }
            ),
          ])
        );

        expectCode(result);
        expect(result.calls).toStrictEqual(['createTable', 'addConstraint']);
        expectSql(
          result,
          `${CREATE_TRUCKS}\nALTER TABLE "kitchen"."trucks" ADD CONSTRAINT "${constraint.name}" ${definition};`
        );
      }
    );

    it.each<[string, Column]>([
      [
        'the parent default and NOT NULL',
        inherited(
          'wheels',
          { parentDefault: '4', parentNotNull: true },
          {
            notNull: true,
            default: '4',
          }
        ),
      ],
      [
        'a PostgreSQL 18 NOT NULL constraint it only inherits',
        inherited(
          'wheels',
          { parentNotNull: true, localNotNull: false },
          {
            notNull: true,
            notNullConstraint: notNull('vehicles_wheels_not_null'),
          }
        ),
      ],
      [
        'no default and no NOT NULL, like its parent',
        inherited('plate', { parentNotNull: false }),
      ],
    ])('leaves a column that only has %s as it is', (_, column) => {
      const result = emitAndRun(emitTable, trucks([column]));

      expectCode(result);
      expect(result.calls).toStrictEqual(['createTable']);
      expectSql(result, CREATE_TRUCKS);
    });

    it('keeps the line break of a default it gives a column it inherits, as a line break fallback', () => {
      // alterColumn writes its actions on one line, so it would turn the line
      // break into a space.
      const setDefault = `SET DEFAULT 'line one\nline two'::text;`;
      const result = emitAndRun(
        emitTable,
        trucks([
          inherited(
            'note',
            { parentNotNull: false },
            { type: 'text', default: "'line one\nline two'::text" }
          ),
        ])
      );

      expectSqlOneOf(result, [
        `${CREATE_TRUCKS}\nALTER TABLE "kitchen"."trucks" ALTER COLUMN "note" ${setDefault}`,
        `${CREATE_TRUCKS}\nALTER TABLE "kitchen"."trucks" ALTER "note" ${setDefault}`,
      ]);
      expectFallback(result, 'line break');
    });

    it('drops the parent default of a column the child also defines without one', () => {
      const result = emitAndRun(
        emitTable,
        makeTable('kitchen', 'trucks', {
          inherits: [VEHICLES],
          columns: [
            makeColumn('wheels', 'integer', {
              inheritCount: 1,
              inheritance: { parentDefault: '4', parentNotNull: false },
            }),
          ],
        })
      );

      expectCode(result);
      expectSql(
        result,
        [
          'CREATE TABLE "kitchen"."trucks" ("wheels" integer) INHERITS ("kitchen"."vehicles");',
          'ALTER TABLE "kitchen"."trucks" ALTER "wheels" DROP DEFAULT;',
        ].join('\n')
      );
    });

    it('does not declare a PostgreSQL 18 NOT NULL that a column the child also defines only inherits', () => {
      const result = emitAndRun(
        emitTable,
        makeTable('kitchen', 'trucks', {
          inherits: [VEHICLES],
          columns: [
            makeColumn('wheels', 'integer', {
              notNull: true,
              notNullConstraint: notNull('vehicles_wheels_not_null'),
              inheritCount: 1,
              inheritance: { parentNotNull: true, localNotNull: false },
            }),
          ],
        })
      );

      expectCode(result);
      expectSql(
        result,
        'CREATE TABLE "kitchen"."trucks" ("wheels" integer) INHERITS ("kitchen"."vehicles");'
      );
    });

    it('declares a PostgreSQL 18 NOT NULL that a column the child also defines declares itself', () => {
      const result = emitAndRun(
        emitTable,
        makeTable('kitchen', 'trucks', {
          inherits: [VEHICLES],
          columns: [
            makeColumn('wheels', 'integer', {
              notNull: true,
              notNullConstraint: notNull('trucks_wheels_not_null'),
              inheritCount: 1,
              inheritance: { parentNotNull: true, localNotNull: true },
            }),
          ],
        })
      );

      expectCode(result);
      expectSql(
        result,
        'CREATE TABLE "kitchen"."trucks" ("wheels" integer NOT NULL) INHERITS ("kitchen"."vehicles");'
      );
    });
  });

  describe('in whole-table fallbacks', () => {
    it('changes the inherited columns of a child with several parents with ALTER TABLE', () => {
      const result = emitAndRun(
        emitTable,
        trucks(
          [
            inherited(
              'wheels',
              { parentDefault: '4', parentNotNull: false },
              {
                default: '6',
                notNull: true,
              }
            ),
            inherited('seats', { parentDefault: '2', parentNotNull: false }),
            inherited(
              'plate',
              { parentNotNull: false, localNotNull: true },
              {
                type: 'text',
                notNull: true,
                notNullConstraint: notNull('plate_required'),
              }
            ),
          ],
          { inherits: [VEHICLES, { schema: 'kitchen', name: 'assets' }] }
        )
      );

      expectFallback(result, 'multiple inheritance');
      expectSql(
        result,
        [
          'CREATE TABLE "kitchen"."trucks" ("payload_kg" integer) INHERITS ("kitchen"."vehicles", "kitchen"."assets");',
          'ALTER TABLE "kitchen"."trucks" ALTER COLUMN "wheels" SET DEFAULT 6;',
          'ALTER TABLE "kitchen"."trucks" ALTER COLUMN "wheels" SET NOT NULL;',
          'ALTER TABLE "kitchen"."trucks" ALTER COLUMN "seats" DROP DEFAULT;',
          'ALTER TABLE "kitchen"."trucks" ADD CONSTRAINT "plate_required" NOT NULL "plate";',
        ].join('\n')
      );
    });

    it('drops the default of a partition column whose partitioned table has one', () => {
      const result = emitAndRun(
        emitTable,
        makeTable('kitchen', 'events_other', {
          partitionOf: {
            parent: { schema: 'kitchen', name: 'events' },
            bound: 'DEFAULT',
          },
          columns: [
            inherited(
              'kind',
              { parentDefault: "'x'::text", parentNotNull: false },
              { type: 'text' }
            ),
            inherited(
              'at',
              { parentDefault: 'now()', parentNotNull: false },
              { type: 'timestamp with time zone', default: 'now()' }
            ),
            inherited(
              'label',
              { parentDefault: "'a'::text", parentNotNull: false },
              { type: 'text', default: "'b'::text" }
            ),
          ],
        })
      );

      expectFallback(result, 'partition');
      expectSql(
        result,
        [
          `CREATE TABLE "kitchen"."events_other" PARTITION OF "kitchen"."events" ("at" WITH OPTIONS DEFAULT now(), "label" WITH OPTIONS DEFAULT 'b'::text) DEFAULT;`,
          'ALTER TABLE "kitchen"."events_other" ALTER COLUMN "kind" DROP DEFAULT;',
        ].join('\n')
      );
    });
  });
});
