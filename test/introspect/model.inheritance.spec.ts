import { describe, expect, it } from 'vitest';
import { rowsToModel } from '../../src/introspect/core/model';
import type { Column, SchemaModel } from '../../src/introspect/types';
import { columnRow, constraintRow, emptyRows, FACTS, tableRow } from './rows';

// What the columns of inheritance children and partitions get from their
// parents' columns (`Column.inheritance`), so that the table emitter can give
// them their own defaults and NOT NULL after `CREATE TABLE`.

const VEHICLES = { schema: 'kitchen', name: 'vehicles' };
const ASSETS = { schema: 'kitchen', name: 'assets' };

/**
 * The columns of a table of the model, by name.
 */
function columnsOf(model: SchemaModel, table: string): Map<string, Column> {
  const found = model.tables.find(({ name }) => name === table);
  if (found === undefined) {
    throw new Error(`no table ${table}`);
  }

  return new Map(found.columns.map((column) => [column.name, column]));
}

/**
 * A column that a table inherits from one parent.
 */
function inheritedRow(
  relid: number,
  attnum: number,
  name: string,
  fields: Parameters<typeof columnRow>[4] = {}
): ReturnType<typeof columnRow> {
  return columnRow(relid, attnum, name, 'integer', {
    attislocal: false,
    attinhcount: 1,
    ...fields,
  });
}

describe('rowsToModel', () => {
  describe('column inheritance', () => {
    it('gives the columns of a child what they get from its parent', () => {
      const model = rowsToModel(
        emptyRows({
          tables: [
            tableRow(20_001, 'kitchen', 'vehicles'),
            tableRow(20_002, 'kitchen', 'trucks', { inherits: [VEHICLES] }),
          ],
          columns: [
            columnRow(20_001, 1, 'wheels', 'integer', {
              attnotnull: true,
              default: '4',
            }),
            columnRow(20_001, 2, 'plate', 'text'),
            inheritedRow(20_002, 1, 'wheels', {
              attnotnull: true,
              default: '6',
            }),
            inheritedRow(20_002, 2, 'plate', { type: 'text' }),
            columnRow(20_002, 3, 'payload_kg', 'integer'),
          ],
        }),
        FACTS
      );

      const trucks = columnsOf(model, 'trucks');
      expect(trucks.get('wheels')?.inheritance).toStrictEqual({
        parentDefault: '4',
        parentNotNull: true,
      });
      expect(trucks.get('plate')?.inheritance).toStrictEqual({
        parentNotNull: false,
      });
      expect(trucks.get('payload_kg')).not.toHaveProperty('inheritance');
      expect(columnsOf(model, 'vehicles').get('wheels')).not.toHaveProperty(
        'inheritance'
      );
    });

    it('takes the default of the first parent that has one, and NOT NULL from any parent', () => {
      const model = rowsToModel(
        emptyRows({
          tables: [
            tableRow(20_011, 'kitchen', 'vehicles'),
            tableRow(20_012, 'kitchen', 'assets'),
            tableRow(20_013, 'kitchen', 'fleet_trucks', {
              inherits: [VEHICLES, ASSETS],
            }),
          ],
          columns: [
            columnRow(20_011, 1, 'code', 'integer'),
            columnRow(20_011, 2, 'label', 'text', { default: "'vehicle'" }),
            columnRow(20_012, 1, 'code', 'integer', {
              attnotnull: true,
              default: '1',
            }),
            columnRow(20_012, 2, 'label', 'text', { default: "'asset'" }),
            inheritedRow(20_013, 1, 'code', {
              attnotnull: true,
              attinhcount: 2,
              default: '1',
            }),
            inheritedRow(20_013, 2, 'label', {
              type: 'text',
              attinhcount: 2,
              default: "'vehicle'",
            }),
          ],
        }),
        FACTS
      );

      const columns = columnsOf(model, 'fleet_trucks');
      expect(columns.get('code')?.inheritance).toStrictEqual({
        parentDefault: '1',
        parentNotNull: true,
      });
      expect(columns.get('label')?.inheritance).toStrictEqual({
        parentDefault: "'vehicle'",
        parentNotNull: false,
      });
    });

    it('does not take the expression of a generated parent column as a default', () => {
      const model = rowsToModel(
        emptyRows({
          tables: [
            tableRow(20_021, 'kitchen', 'vehicles'),
            tableRow(20_022, 'kitchen', 'trucks', { inherits: [VEHICLES] }),
          ],
          columns: [
            columnRow(20_021, 1, 'doubled', 'integer', {
              attgenerated: 's',
              default: '(wheels * 2)',
            }),
            inheritedRow(20_022, 1, 'doubled', {
              attgenerated: 's',
              default: '(wheels * 2)',
            }),
          ],
        }),
        FACTS
      );

      const doubled = columnsOf(model, 'trucks').get('doubled');
      expect(doubled?.inheritance).toStrictEqual({ parentNotNull: false });
      expect(doubled).not.toHaveProperty('default');
    });

    it('reads PostgreSQL 18 NOT NULL constraints: NO INHERIT ones are not inherited, and whether the child declares its own', () => {
      const model = rowsToModel(
        emptyRows({
          tables: [
            tableRow(20_031, 'kitchen', 'vehicles'),
            tableRow(20_032, 'kitchen', 'trucks', { inherits: [VEHICLES] }),
          ],
          columns: [
            columnRow(20_031, 1, 'wheels', 'integer', { attnotnull: true }),
            columnRow(20_031, 2, 'plate', 'text', { attnotnull: true }),
            columnRow(20_031, 3, 'seats', 'integer', { attnotnull: true }),
            inheritedRow(20_032, 1, 'wheels', { attnotnull: true }),
            inheritedRow(20_032, 2, 'plate', { type: 'text' }),
            inheritedRow(20_032, 3, 'seats', { attnotnull: true }),
          ],
          constraints: [
            constraintRow(
              20_033,
              'kitchen',
              'vehicles_wheels_not_null',
              20_031,
              'n',
              'NOT NULL wheels',
              { conkey: [1] }
            ),
            constraintRow(
              20_034,
              'kitchen',
              'vehicles_plate_not_null',
              20_031,
              'n',
              'NOT NULL plate NO INHERIT',
              { conkey: [2], connoinherit: true }
            ),
            constraintRow(
              20_035,
              'kitchen',
              'vehicles_seats_not_null',
              20_031,
              'n',
              'NOT NULL seats',
              { conkey: [3] }
            ),
            constraintRow(
              20_036,
              'kitchen',
              'vehicles_wheels_not_null',
              20_032,
              'n',
              'NOT NULL wheels',
              { conkey: [1], conislocal: false }
            ),
            constraintRow(
              20_037,
              'kitchen',
              'vehicles_seats_not_null',
              20_032,
              'n',
              'NOT NULL seats',
              { conkey: [3], conislocal: true }
            ),
          ],
        }),
        FACTS
      );

      const trucks = columnsOf(model, 'trucks');
      expect(trucks.get('wheels')?.inheritance).toStrictEqual({
        parentNotNull: true,
        localNotNull: false,
      });
      expect(trucks.get('plate')?.inheritance).toStrictEqual({
        parentNotNull: false,
      });
      expect(trucks.get('seats')?.inheritance).toStrictEqual({
        parentNotNull: true,
        localNotNull: true,
      });
      expect(trucks.get('seats')?.notNullConstraint).toStrictEqual({
        name: 'vehicles_seats_not_null',
        noInherit: false,
        validated: true,
      });
    });

    it('gives the columns of a partition what they get from its partitioned table', () => {
      const model = rowsToModel(
        emptyRows({
          tables: [
            tableRow(20_041, 'kitchen', 'events', {
              relkind: 'p',
              partitionKey: 'RANGE (at)',
            }),
            tableRow(20_042, 'kitchen', 'events_2026', {
              relispartition: true,
              partitionBound:
                "FOR VALUES FROM ('2026-01-01') TO ('2027-01-01')",
              inherits: [{ schema: 'kitchen', name: 'events' }],
            }),
          ],
          columns: [
            columnRow(20_041, 1, 'kind', 'text', {
              attnotnull: true,
              default: "'x'::text",
            }),
            inheritedRow(20_042, 1, 'kind', {
              type: 'text',
              attnotnull: true,
            }),
          ],
        }),
        FACTS
      );

      const kind = columnsOf(model, 'events_2026').get('kind');
      expect(kind?.inheritance).toStrictEqual({
        parentDefault: "'x'::text",
        parentNotNull: true,
      });
      expect(kind).not.toHaveProperty('default');
    });

    it('reads a parent that is out of scope, since the child still inherits from it', () => {
      const model = rowsToModel(
        emptyRows({
          tables: [
            tableRow(20_051, 'fleet', 'vehicles'),
            tableRow(20_052, 'kitchen', 'trucks', {
              inherits: [{ schema: 'fleet', name: 'vehicles' }],
            }),
          ],
          columns: [
            columnRow(20_051, 1, 'wheels', 'integer', { default: '4' }),
            inheritedRow(20_052, 1, 'wheels', { default: '4' }),
          ],
        }),
        { ...FACTS, excludeSchemas: ['fleet'] }
      );

      expect(model.tables.map(({ name }) => name)).toStrictEqual(['trucks']);
      expect(
        columnsOf(model, 'trucks').get('wheels')?.inheritance
      ).toStrictEqual({ parentDefault: '4', parentNotNull: false });
    });

    it.each([
      {
        case: 'a parent that is not among the tables',
        tables: [
          tableRow(20_062, 'kitchen', 'trucks', { inherits: [VEHICLES] }),
        ],
      },
      {
        case: 'parents that do not have the column',
        tables: [
          tableRow(20_061, 'kitchen', 'vehicles'),
          tableRow(20_062, 'kitchen', 'trucks', { inherits: [VEHICLES] }),
        ],
      },
      {
        case: 'a table without parents',
        tables: [tableRow(20_062, 'kitchen', 'trucks')],
      },
    ])('leaves out inheritance with $case', ({ tables }) => {
      const model = rowsToModel(
        emptyRows({
          tables,
          columns: [
            columnRow(20_061, 1, 'plate', 'text'),
            inheritedRow(20_062, 1, 'wheels', { default: '4' }),
          ],
        }),
        FACTS
      );

      expect(columnsOf(model, 'trucks').get('wheels')).not.toHaveProperty(
        'inheritance'
      );
    });
  });
});
