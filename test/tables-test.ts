import { expect } from 'chai'
import * as Tables from '../src/operations/tables'
import { options1, options2 } from './utils'

type CreateTableParams = Parameters<ReturnType<typeof Tables.createTable>>
type DropColumnsParams = Parameters<ReturnType<typeof Tables.dropColumns>>
type AddConstraintParams = Parameters<ReturnType<typeof Tables.addConstraint>>

describe('lib/operations/tables', () => {
  describe('.create', () => {
    it('check schemas can be used', () => {
      const args: CreateTableParams = [{ schema: 'mySchema', name: 'myTableName' }, { idColumn: 'serial' }]
      const sql1 = Tables.createTable(options1)(...args)
      const sql2 = Tables.createTable(options2)(...args)
      expect(sql1).to.equal(`CREATE TABLE "mySchema"."myTableName" (
  "idColumn" serial
);`)
      expect(sql2).to.equal(`CREATE TABLE "my_schema"."my_table_name" (
  "id_column" serial
);`)
    })

    it('check shorthands work', () => {
      const args: CreateTableParams = ['myTableName', { idColumn: 'id' }]
      const sql1 = Tables.createTable(options1)(...args)
      const sql2 = Tables.createTable(options2)(...args)
      expect(sql1).to.equal(`CREATE TABLE "myTableName" (
  "idColumn" serial PRIMARY KEY
);`)
      expect(sql2).to.equal(`CREATE TABLE "my_table_name" (
  "id_column" serial PRIMARY KEY
);`)
    })

    it('check custom shorthands can be used', () => {
      const args: CreateTableParams = ['myTableName', { idColumn: 'idTest' }]
      const sql1 = Tables.createTable({
        ...options1,
        typeShorthands: {
          ...options1.typeShorthands,
          idTest: { type: 'uuid', primaryKey: true },
        },
      })(...args)
      const sql2 = Tables.createTable({
        ...options2,
        typeShorthands: {
          ...options2.typeShorthands,
          idTest: { type: 'uuid', primaryKey: true },
        },
      })(...args)
      expect(sql1).to.equal(`CREATE TABLE "myTableName" (
  "idColumn" uuid PRIMARY KEY
);`)
      expect(sql2).to.equal(`CREATE TABLE "my_table_name" (
  "id_column" uuid PRIMARY KEY
);`)
    })

    it('check schemas can be used for foreign keys', () => {
      const args: CreateTableParams = [
        'myTableName',
        {
          parentId: {
            type: 'integer',
            references: { schema: 'schemaA', name: 'tableB' },
          },
        },
      ]
      const sql1 = Tables.createTable(options1)(...args)
      const sql2 = Tables.createTable(options2)(...args)
      expect(sql1).to.equal(`CREATE TABLE "myTableName" (
  "parentId" integer REFERENCES "schemaA"."tableB"
);`)
      expect(sql2).to.equal(`CREATE TABLE "my_table_name" (
  "parent_id" integer REFERENCES "schema_a"."table_b"
);`)
    })

    it('check match clause can be used for foreign keys', () => {
      const args: CreateTableParams = [
        'myTableName',
        {
          parentId: {
            type: 'integer',
            references: { schema: 'schemaA', name: 'tableB' },
            match: 'SIMPLE',
          },
        },
      ]
      const sql1 = Tables.createTable(options1)(...args)
      const sql2 = Tables.createTable(options2)(...args)
      expect(sql1).to.equal(`CREATE TABLE "myTableName" (
  "parentId" integer REFERENCES "schemaA"."tableB" MATCH SIMPLE
);`)
      expect(sql2).to.equal(`CREATE TABLE "my_table_name" (
  "parent_id" integer REFERENCES "schema_a"."table_b" MATCH SIMPLE
);`)
    })

    it('check defining column can be used for foreign keys', () => {
      const args: CreateTableParams = [
        'myTableName',
        {
          parentId: { type: 'integer', references: 'schemaA.tableB(idColumn)' },
        },
      ]
      const sql1 = Tables.createTable(options1)(...args)
      const sql2 = Tables.createTable(options2)(...args)
      expect(sql1).to.equal(`CREATE TABLE "myTableName" (
  "parentId" integer REFERENCES schemaA.tableB(idColumn)
);`)
      expect(sql2).to.equal(`CREATE TABLE "my_table_name" (
  "parent_id" integer REFERENCES schemaA.tableB(idColumn)
);`)
    })

    it('check multicolumn primary key name does not include schema', () => {
      const args: CreateTableParams = [
        { schema: 'mySchema', name: 'myTableName' },
        {
          colA: { type: 'integer', primaryKey: true },
          colB: { type: 'varchar', primaryKey: true },
        },
      ]
      const sql1 = Tables.createTable(options1)(...args)
      const sql2 = Tables.createTable(options2)(...args)
      expect(sql1).to.equal(`CREATE TABLE "mySchema"."myTableName" (
  "colA" integer,
  "colB" varchar,
  CONSTRAINT "myTableName_pkey" PRIMARY KEY ("colA", "colB")
);`)
      expect(sql2).to.equal(`CREATE TABLE "my_schema"."my_table_name" (
  "col_a" integer,
  "col_b" varchar,
  CONSTRAINT "my_table_name_pkey" PRIMARY KEY ("col_a", "col_b")
);`)
    })

    it('check table references work correctly', () => {
      const args: CreateTableParams = [
        'myTableName',
        {
          colA: { type: 'integer' },
          colB: { type: 'varchar' },
        },
        {
          constraints: {
            foreignKeys: [
              {
                columns: ['colA', 'colB'],
                references: 'otherTable (A, B)',
              },
            ],
          },
        },
      ]
      const sql1 = Tables.createTable(options1)(...args)
      const sql2 = Tables.createTable(options2)(...args)
      expect(sql1).to.equal(`CREATE TABLE "myTableName" (
  "colA" integer,
  "colB" varchar,
  CONSTRAINT "myTableName_fk_colA_colB" FOREIGN KEY ("colA", "colB") REFERENCES otherTable (A, B)
);`)
      expect(sql2).to.equal(`CREATE TABLE "my_table_name" (
  "col_a" integer,
  "col_b" varchar,
  CONSTRAINT "my_table_name_fk_col_a_col_b" FOREIGN KEY ("col_a", "col_b") REFERENCES otherTable (A, B)
);`)
    })

    it('check table unique constraint work correctly', () => {
      const args: CreateTableParams = [
        'myTableName',
        {
          colA: { type: 'integer' },
          colB: { type: 'varchar' },
        },
        {
          constraints: {
            unique: ['colA', 'colB'],
          },
        },
      ]
      const sql1 = Tables.createTable(options1)(...args)
      const sql2 = Tables.createTable(options2)(...args)
      expect(sql1).to.equal(`CREATE TABLE "myTableName" (
  "colA" integer,
  "colB" varchar,
  CONSTRAINT "myTableName_uniq_colA_colB" UNIQUE ("colA", "colB")
);`)
      expect(sql2).to.equal(`CREATE TABLE "my_table_name" (
  "col_a" integer,
  "col_b" varchar,
  CONSTRAINT "my_table_name_uniq_col_a_col_b" UNIQUE ("col_a", "col_b")
);`)
    })

    it('check table unique constraint work correctly for string', () => {
      const args: CreateTableParams = [
        'myTableName',
        {
          colA: { type: 'integer' },
          colB: { type: 'varchar' },
        },
        {
          constraints: {
            unique: 'colA',
          },
        },
      ]
      const sql1 = Tables.createTable(options1)(...args)
      const sql2 = Tables.createTable(options2)(...args)
      expect(sql1).to.equal(`CREATE TABLE "myTableName" (
  "colA" integer,
  "colB" varchar,
  CONSTRAINT "myTableName_uniq_colA" UNIQUE ("colA")
);`)
      expect(sql2).to.equal(`CREATE TABLE "my_table_name" (
  "col_a" integer,
  "col_b" varchar,
  CONSTRAINT "my_table_name_uniq_col_a" UNIQUE ("col_a")
);`)
    })

    it('check table unique constraint work correctly for array of arrays', () => {
      const args: CreateTableParams = [
        'myTableName',
        {
          colA: { type: 'integer' },
          colB: { type: 'varchar' },
          colC: { type: 'varchar' },
        },
        {
          constraints: {
            unique: [['colA', 'colB'], 'colC'],
          },
        },
      ]
      const sql1 = Tables.createTable(options1)(...args)
      const sql2 = Tables.createTable(options2)(...args)
      expect(sql1).to.equal(`CREATE TABLE "myTableName" (
  "colA" integer,
  "colB" varchar,
  "colC" varchar,
  CONSTRAINT "myTableName_uniq_colA_colB" UNIQUE ("colA", "colB"),
  CONSTRAINT "myTableName_uniq_colC" UNIQUE ("colC")
);`)
      expect(sql2).to.equal(`CREATE TABLE "my_table_name" (
  "col_a" integer,
  "col_b" varchar,
  "col_c" varchar,
  CONSTRAINT "my_table_name_uniq_col_a_col_b" UNIQUE ("col_a", "col_b"),
  CONSTRAINT "my_table_name_uniq_col_c" UNIQUE ("col_c")
);`)
    })

    it('creates comments on foreign keys', () => {
      const args: CreateTableParams = [
        'myTableName',
        {
          colA: { type: 'integer' },
        },
        {
          constraints: {
            foreignKeys: {
              columns: ['colA'],
              references: 'otherTable',
              referencesConstraintComment: 'example comment',
            },
          },
        },
      ]
      const sql1 = Tables.createTable(options1)(...args)
      const sql2 = Tables.createTable(options2)(...args)
      expect(sql1).to.equal(`CREATE TABLE "myTableName" (
  "colA" integer,
  CONSTRAINT "myTableName_fk_colA" FOREIGN KEY ("colA") REFERENCES "otherTable"
);
COMMENT ON CONSTRAINT "myTableName_fk_colA" ON "myTableName" IS $pg1$example comment$pg1$;`)
      expect(sql2).to.equal(`CREATE TABLE "my_table_name" (
  "col_a" integer,
  CONSTRAINT "my_table_name_fk_col_a" FOREIGN KEY ("col_a") REFERENCES "other_table"
);
COMMENT ON CONSTRAINT "my_table_name_fk_col_a" ON "my_table_name" IS $pg1$example comment$pg1$;`)
    })

    it('creates comments on column foreign keys', () => {
      const args: CreateTableParams = [
        'myTableName',
        {
          colA: {
            type: 'integer',
            references: 'otherTable (a)',
            referencesConstraintComment: 'fk a comment',
          },
          colB: {
            type: 'integer',
            references: 'otherTableTwo',
            referencesConstraintName: 'fkColB',
            referencesConstraintComment: 'fk b comment',
          },
        },
      ]
      const sql1 = Tables.createTable(options1)(...args)
      const sql2 = Tables.createTable(options2)(...args)
      expect(sql1).to.equal(`CREATE TABLE "myTableName" (
  "colA" integer CONSTRAINT "myTableName_fk_colA" REFERENCES otherTable (a),
  "colB" integer CONSTRAINT "fkColB" REFERENCES "otherTableTwo"
);
COMMENT ON CONSTRAINT "myTableName_fk_colA" ON "myTableName" IS $pg1$fk a comment$pg1$;
COMMENT ON CONSTRAINT "fkColB" ON "myTableName" IS $pg1$fk b comment$pg1$;`)
      expect(sql2).to.equal(`CREATE TABLE "my_table_name" (
  "col_a" integer CONSTRAINT "my_table_name_fk_col_a" REFERENCES otherTable (a),
  "col_b" integer CONSTRAINT "fk_col_b" REFERENCES "other_table_two"
);
COMMENT ON CONSTRAINT "my_table_name_fk_col_a" ON "my_table_name" IS $pg1$fk a comment$pg1$;
COMMENT ON CONSTRAINT "fk_col_b" ON "my_table_name" IS $pg1$fk b comment$pg1$;`)
    })

    it('creates no comments on unnamed constraints', () => {
      const args: CreateTableParams = [
        'myTableName',
        {
          colA: { type: 'integer' },
        },
        {
          constraints: {
            primaryKey: 'colA',
            comment: 'example comment',
          },
        },
      ]
      expect(() => Tables.createTable(options1)(...args)).to.throw('cannot comment on unspecified constraints')
      expect(() => Tables.createTable(options2)(...args)).to.throw('cannot comment on unspecified constraints')
    })
  })

  describe('.dropColumns', () => {
    it('check multiple columns can be dropped', () => {
      const args: DropColumnsParams = ['myTableName', ['colC1', 'colC2']]
      const sql1 = Tables.dropColumns(options1)(...args)
      const sql2 = Tables.dropColumns(options2)(...args)
      expect(sql1).to.equal(`ALTER TABLE "myTableName"
  DROP "colC1",
  DROP "colC2";`)
      expect(sql2).to.equal(`ALTER TABLE "my_table_name"
  DROP "col_c1",
  DROP "col_c2";`)
    })
  })

  describe('.addConstraint', () => {
    it('works with strings', () => {
      const args: AddConstraintParams = ['myTableName', 'myConstraintName', 'CHECK name IS NOT NULL']
      const sql1 = Tables.addConstraint(options1)(...args)
      const sql2 = Tables.addConstraint(options2)(...args)
      expect(sql1).to.equal(`ALTER TABLE "myTableName"
  ADD CONSTRAINT "myConstraintName" CHECK name IS NOT NULL;`)
      expect(sql2).to.equal(`ALTER TABLE "my_table_name"
  ADD CONSTRAINT "my_constraint_name" CHECK name IS NOT NULL;`)
    })

    it('does not add contraint name if not defined', () => {
      const args: AddConstraintParams = ['myTableName', null, 'CHECK name IS NOT NULL']
      const sql1 = Tables.addConstraint(options1)(...args)
      const sql2 = Tables.addConstraint(options2)(...args)
      expect(sql1).to.equal(`ALTER TABLE "myTableName"
  ADD CHECK name IS NOT NULL;`)
      expect(sql2).to.equal(`ALTER TABLE "my_table_name"
  ADD CHECK name IS NOT NULL;`)
    })

    it('can create comments', () => {
      const args: AddConstraintParams = [
        'myTableName',
        'myConstraintName',
        {
          primaryKey: 'colA',
          comment: 'this is an important primary key',
        },
      ]
      const sql1 = Tables.addConstraint(options1)(...args)
      const sql2 = Tables.addConstraint(options2)(...args)
      expect(sql1).to.equal(`ALTER TABLE "myTableName"
  ADD CONSTRAINT "myConstraintName" PRIMARY KEY ("colA");
COMMENT ON CONSTRAINT "myConstraintName" ON "myTableName" IS $pg1$this is an important primary key$pg1$;`)
      expect(sql2).to.equal(`ALTER TABLE "my_table_name"
  ADD CONSTRAINT "my_constraint_name" PRIMARY KEY ("col_a");
COMMENT ON CONSTRAINT "my_constraint_name" ON "my_table_name" IS $pg1$this is an important primary key$pg1$;`)
    })
  })
})
