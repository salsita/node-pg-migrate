import { expect } from 'chai';
import * as Tables from '../lib/operations/tables';

describe('lib/operations/tables', () => {
  describe('.create', () => {
    it('check schemas can be used', () => {
      const sql = Tables.create()({ schema: 'my_schema', name: 'my_table_name' }, { id: 'serial' });
      expect(sql).to.equal(`CREATE TABLE "my_schema"."my_table_name" (
  "id" serial
);`);
    });

    it('check shorthands work', () => {
      const sql = Tables.create()('my_table_name', { id: 'id' });
      expect(sql).to.equal(`CREATE TABLE "my_table_name" (
  "id" serial PRIMARY KEY
);`);
    });

    it('check custom shorthands can be used', () => {
      const sql = Tables.create({ id: { type: 'uuid', primaryKey: true } })('my_table_name', { id: 'id' });
      expect(sql).to.equal(`CREATE TABLE "my_table_name" (
  "id" uuid PRIMARY KEY
);`);
    });

    it('check schemas can be used for foreign keys', () => {
      const sql = Tables.create()('my_table_name', {
        parent_id: {
          type: 'integer',
          references: { schema: 'a', name: 'b' },
        },
      });
      expect(sql).to.equal(`CREATE TABLE "my_table_name" (
  "parent_id" integer REFERENCES "a"."b"
);`);
    });

    it('check match clause can be used for foreign keys', () => {
      const sql = Tables.create()('my_table_name', {
        parent_id: {
          type: 'integer',
          references: { schema: 'a', name: 'b' },
          match: 'SIMPLE',
        },
      });
      expect(sql).to.equal(`CREATE TABLE "my_table_name" (
  "parent_id" integer REFERENCES "a"."b" MATCH SIMPLE
);`);
    });

    it('check defining column can be used for foreign keys', () => {
      const sql = Tables.create()('my_table_name', { parent_id: { type: 'integer', references: 'a.b(id)' } });
      expect(sql).to.equal(`CREATE TABLE "my_table_name" (
  "parent_id" integer REFERENCES a.b(id)
);`);
    });

    it('check multicolumn primary key name does not include schema', () => {
      const sql = Tables.create()({ schema: 's', name: 'my_table_name' }, {
        a: { type: 'integer', primaryKey: true },
        b: { type: 'varchar', primaryKey: true },
      });
      expect(sql).to.equal(`CREATE TABLE "s"."my_table_name" (
  "a" integer,
  "b" varchar,
  CONSTRAINT "my_table_name_pkey" PRIMARY KEY ("a", "b")
);`);
    });

    it('check table references work correctly', () => {
      const sql = Tables.create()(
        'my_table_name',
        {
          a: { type: 'integer' },
          b: { type: 'varchar' },
        },
        {
          constraints: {
            foreignKeys: [
              {
                columns: ['a', 'b'],
                references: 'otherTable (A, B)',
              },
            ],
          },
        }
      );
      expect(sql).to.equal(`CREATE TABLE "my_table_name" (
  "a" integer,
  "b" varchar,
  CONSTRAINT "my_table_name_fk_a_b" FOREIGN KEY ("a", "b") REFERENCES otherTable (A, B)
);`);
    });

    it('check table unique constraint work correctly', () => {
      const sql = Tables.create()(
        'my_table_name',
        {
          a: { type: 'integer' },
          b: { type: 'varchar' },
        },
        {
          constraints: {
            unique: ['a', 'b'],
          },
        }
      );
      expect(sql).to.equal(`CREATE TABLE "my_table_name" (
  "a" integer,
  "b" varchar,
  CONSTRAINT "my_table_name_uniq_a_b" UNIQUE ("a", "b")
);`);
    });

    it('check table unique constraint work correctly for array of arrays', () => {
      const sql = Tables.create()(
        'my_table_name',
        {
          a: { type: 'integer' },
          b: { type: 'varchar' },
          c: { type: 'varchar' },
        },
        {
          constraints: {
            unique: [
              ['a', 'b'],
              'c',
            ],
          },
        }
      );
      expect(sql).to.equal(`CREATE TABLE "my_table_name" (
  "a" integer,
  "b" varchar,
  "c" varchar,
  CONSTRAINT "my_table_name_uniq_a_b" UNIQUE ("a", "b"),
  CONSTRAINT "my_table_name_uniq_c" UNIQUE ("c")
);`);
    });
  });

  describe('.dropColumns', () => {
    it('check multiple columns can be dropped', () => {
      const sql = Tables.dropColumns('my_table_name', ['c1', 'c2']);
      expect(sql).to.equal(`ALTER TABLE "my_table_name"
  DROP "c1",
  DROP "c2";`);
    });
  });
});
