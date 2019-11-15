import { expect } from 'chai';
import * as Tables from '../src/operations/tables';
import { options1, options2 } from './utils';

describe('lib/operations/tables', () => {
  describe('.create', () => {
    it('check schemas can be used', () => {
      [
        [
          Tables.createTable(options1),
          `CREATE TABLE "mySchema"."myTableName" (
  "idColumn" serial
);`,
        ],
        [
          Tables.createTable(options2),
          `CREATE TABLE "my_schema"."my_table_name" (
  "id_column" serial
);`,
        ],
      ].forEach(([fn, res]: [ReturnType<typeof Tables.createTable>, string]) => {
        expect(fn({ schema: 'mySchema', name: 'myTableName' }, { idColumn: 'serial' })).to.equal(res)
      })
    });

    it('check shorthands work', () => {
      [
        [
          Tables.createTable(options1),
          `CREATE TABLE "myTableName" (
  "idColumn" serial PRIMARY KEY
);`,
        ],
        [
          Tables.createTable(options2),
          `CREATE TABLE "my_table_name" (
  "id_column" serial PRIMARY KEY
);`,
        ],
      ].forEach(([fn, res]: [ReturnType<typeof Tables.createTable>, string]) => {
        expect(fn('myTableName', { idColumn: 'id' })).to.equal(res)
      })
    });

    it('check custom shorthands can be used', () => {
      [
        [
          Tables.createTable({
            ...options1,
            typeShorthands: {
              ...options1.typeShorthands,
              idTest: { type: 'uuid', primaryKey: true }
            }
          }),
          `CREATE TABLE "myTableName" (
  "idColumn" uuid PRIMARY KEY
);`,
        ],
        [
          Tables.createTable({
            ...options2,
            typeShorthands: {
              ...options2.typeShorthands,
              idTest: { type: 'uuid', primaryKey: true }
            }
          }),
          `CREATE TABLE "my_table_name" (
  "id_column" uuid PRIMARY KEY
);`,
        ],
      ].forEach(([fn, res]: [ReturnType<typeof Tables.createTable>, string]) => {
        expect(fn('myTableName', { idColumn: 'idTest' })).to.equal(res)
      })
    });

    it('check schemas can be used for foreign keys', () => {
      [
        [
          Tables.createTable(options1),
          `CREATE TABLE "myTableName" (
  "parentId" integer REFERENCES "schemaA"."tableB"
);`,
        ],
        [
          Tables.createTable(options2),
          `CREATE TABLE "my_table_name" (
  "parent_id" integer REFERENCES "schema_a"."table_b"
);`,
        ],
      ].forEach(([fn, res]: [ReturnType<typeof Tables.createTable>, string]) => {
        expect(fn(
          'myTableName',
          {
            parentId: {
              type: 'integer',
              references: { schema: 'schemaA', name: 'tableB' }
            }
          }
        )).to.equal(res)
      })
    });

    it('check match clause can be used for foreign keys', () => {
      [
        [
          Tables.createTable(options1),
          `CREATE TABLE "myTableName" (
  "parentId" integer REFERENCES "schemaA"."tableB" MATCH SIMPLE
);`,
        ],
        [
          Tables.createTable(options2),
          `CREATE TABLE "my_table_name" (
  "parent_id" integer REFERENCES "schema_a"."table_b" MATCH SIMPLE
);`,
        ],
      ].forEach(([fn, res]: [ReturnType<typeof Tables.createTable>, string]) => {
        expect(fn(
          'myTableName',
          {
            parentId: {
              type: 'integer',
              references: { schema: 'schemaA', name: 'tableB' },
              match: 'SIMPLE'
            }
          }
        )).to.equal(res)
      })
    });

    it('check defining column can be used for foreign keys', () => {
      [
        [
          Tables.createTable(options1),
          `CREATE TABLE "myTableName" (
  "parentId" integer REFERENCES schemaA.tableB(idColumn)
);`,
        ],
        [
          Tables.createTable(options2),
          `CREATE TABLE "my_table_name" (
  "parent_id" integer REFERENCES schemaA.tableB(idColumn)
);`,
        ],
      ].forEach(([fn, res]: [ReturnType<typeof Tables.createTable>, string]) => {
        expect(fn(
          'myTableName',
          {
            parentId: { type: 'integer', references: 'schemaA.tableB(idColumn)' }
          }
        )).to.equal(res)
      })
    });

    it('check multicolumn primary key name does not include schema', () => {
      [
        [
          Tables.createTable(options1),
          `CREATE TABLE "mySchema"."myTableName" (
  "colA" integer,
  "colB" varchar,
  CONSTRAINT "myTableName_pkey" PRIMARY KEY ("colA", "colB")
);`,
        ],
        [
          Tables.createTable(options2),
          `CREATE TABLE "my_schema"."my_table_name" (
  "col_a" integer,
  "col_b" varchar,
  CONSTRAINT "my_table_name_pkey" PRIMARY KEY ("col_a", "col_b")
);`,
        ],
      ].forEach(([fn, res]: [ReturnType<typeof Tables.createTable>, string]) => {
        expect(fn(
          { schema: 'mySchema', name: 'myTableName' },
          {
            colA: { type: 'integer', primaryKey: true },
            colB: { type: 'varchar', primaryKey: true }
          }
        )).to.equal(res)
      })
    });

    it('check table references work correctly', () => {
      [
        [
          Tables.createTable(options1),
          `CREATE TABLE "myTableName" (
  "colA" integer,
  "colB" varchar,
  CONSTRAINT "myTableName_fk_colA_colB" FOREIGN KEY ("colA", "colB") REFERENCES otherTable (A, B)
);`,
        ],
        [
          Tables.createTable(options2),
          `CREATE TABLE "my_table_name" (
  "col_a" integer,
  "col_b" varchar,
  CONSTRAINT "my_table_name_fk_col_a_col_b" FOREIGN KEY ("col_a", "col_b") REFERENCES otherTable (A, B)
);`,
        ],
      ].forEach(([fn, res]: [ReturnType<typeof Tables.createTable>, string]) => {
        expect(fn(
          'myTableName',
          {
            colA: { type: 'integer' },
            colB: { type: 'varchar' }
          },
          {
            constraints: {
              foreignKeys: [
                {
                  columns: ['colA', 'colB'],
                  references: 'otherTable (A, B)'
                }
              ]
            }
          }
        )).to.equal(res)
      })
    });

    it('check table unique constraint work correctly', () => {
      [
        [
          Tables.createTable(options1),
          `CREATE TABLE "myTableName" (
  "colA" integer,
  "colB" varchar,
  CONSTRAINT "myTableName_uniq_colA_colB" UNIQUE ("colA", "colB")
);`,
        ],
        [
          Tables.createTable(options2),
          `CREATE TABLE "my_table_name" (
  "col_a" integer,
  "col_b" varchar,
  CONSTRAINT "my_table_name_uniq_col_a_col_b" UNIQUE ("col_a", "col_b")
);`,
        ],
      ].forEach(([fn, res]: [ReturnType<typeof Tables.createTable>, string]) => {
        expect(fn(
          'myTableName',
          {
            colA: { type: 'integer' },
            colB: { type: 'varchar' }
          },
          {
            constraints: {
              unique: ['colA', 'colB']
            }
          }
        )).to.equal(res)
      })
    });

    it('check table unique constraint work correctly for string', () => {
      [
        [
          Tables.createTable(options1),
          `CREATE TABLE "myTableName" (
  "colA" integer,
  "colB" varchar,
  CONSTRAINT "myTableName_uniq_colA" UNIQUE ("colA")
);`,
        ],
        [
          Tables.createTable(options2),
          `CREATE TABLE "my_table_name" (
  "col_a" integer,
  "col_b" varchar,
  CONSTRAINT "my_table_name_uniq_col_a" UNIQUE ("col_a")
);`,
        ],
      ].forEach(([fn, res]: [ReturnType<typeof Tables.createTable>, string]) => {
        expect(fn(
          'myTableName',
          {
            colA: { type: 'integer' },
            colB: { type: 'varchar' }
          },
          {
            constraints: {
              unique: 'colA'
            }
          }
        )).to.equal(res)
      })
    });

    it('check table unique constraint work correctly for array of arrays', () => {
      [
        [
          Tables.createTable(options1),
          `CREATE TABLE "myTableName" (
  "colA" integer,
  "colB" varchar,
  "colC" varchar,
  CONSTRAINT "myTableName_uniq_colA_colB" UNIQUE ("colA", "colB"),
  CONSTRAINT "myTableName_uniq_colC" UNIQUE ("colC")
);`,
        ],
        [
          Tables.createTable(options2),
          `CREATE TABLE "my_table_name" (
  "col_a" integer,
  "col_b" varchar,
  "col_c" varchar,
  CONSTRAINT "my_table_name_uniq_col_a_col_b" UNIQUE ("col_a", "col_b"),
  CONSTRAINT "my_table_name_uniq_col_c" UNIQUE ("col_c")
);`,
        ],
      ].forEach(([fn, res]: [ReturnType<typeof Tables.createTable>, string]) => {
        expect(fn(
          'myTableName',
          {
            colA: { type: 'integer' },
            colB: { type: 'varchar' },
            colC: { type: 'varchar' }
          },
          {
            constraints: {
              unique: [['colA', 'colB'], 'colC']
            }
          }
        )).to.equal(res)
      })
    });

    it('creates comments on foreign keys', () => {
      [
        [
          Tables.createTable(options1),
          `CREATE TABLE "myTableName" (
  "colA" integer,
  CONSTRAINT "myTableName_fk_colA" FOREIGN KEY ("colA") REFERENCES "otherTable"
);
COMMENT ON CONSTRAINT "myTableName_fk_colA" ON "myTableName" IS $pg1$example comment$pg1$;`,
        ],
        [
          Tables.createTable(options2),
          `CREATE TABLE "my_table_name" (
  "col_a" integer,
  CONSTRAINT "my_table_name_fk_col_a" FOREIGN KEY ("col_a") REFERENCES "other_table"
);
COMMENT ON CONSTRAINT "my_table_name_fk_col_a" ON "my_table_name" IS $pg1$example comment$pg1$;`,
        ],
      ].forEach(([fn, res]: [ReturnType<typeof Tables.createTable>, string]) => {
        expect(fn(
          'myTableName',
          {
            colA: { type: 'integer' }
          },
          {
            constraints: {
              foreignKeys: {
                columns: ['colA'],
                references: 'otherTable',
                referencesConstraintComment: 'example comment'
              }
            }
          }
        )).to.equal(res)
      })
    });

    it('creates comments on column foreign keys', () => {
      [
        [
          Tables.createTable(options1),
          `CREATE TABLE "myTableName" (
  "colA" integer CONSTRAINT "myTableName_fk_colA" REFERENCES otherTable (a),
  "colB" integer CONSTRAINT "fkColB" REFERENCES "otherTableTwo"
);
COMMENT ON CONSTRAINT "myTableName_fk_colA" ON "myTableName" IS $pg1$fk a comment$pg1$;
COMMENT ON CONSTRAINT "fkColB" ON "myTableName" IS $pg1$fk b comment$pg1$;`,
        ],
        [
          Tables.createTable(options2),
          `CREATE TABLE "my_table_name" (
  "col_a" integer CONSTRAINT "my_table_name_fk_col_a" REFERENCES otherTable (a),
  "col_b" integer CONSTRAINT "fk_col_b" REFERENCES "other_table_two"
);
COMMENT ON CONSTRAINT "my_table_name_fk_col_a" ON "my_table_name" IS $pg1$fk a comment$pg1$;
COMMENT ON CONSTRAINT "fk_col_b" ON "my_table_name" IS $pg1$fk b comment$pg1$;`,
        ],
      ].forEach(([fn, res]: [ReturnType<typeof Tables.createTable>, string]) => {
        expect(fn(
          'myTableName',
          {
            colA: {
              type: 'integer',
              references: 'otherTable (a)',
              referencesConstraintComment: 'fk a comment'
            },
            colB: {
              type: 'integer',
              references: 'otherTableTwo',
              referencesConstraintName: 'fkColB',
              referencesConstraintComment: 'fk b comment'
            }
          }
        )).to.equal(res)
      })
    });

    it('creates no comments on unnamed constraints', () => {
      [
        Tables.createTable(options1),
        Tables.createTable(options2),
      ].forEach((fn: ReturnType<typeof Tables.createTable>) => {
        expect(() => fn(
          'myTableName',
          {
            colA: { type: 'integer' }
          },
          {
            constraints: {
              primaryKey: 'colA',
              comment: 'example comment'
            }
          }
        )).to.throw(
          'cannot comment on unspecified constraints'
        );
      })
    });
  });

  describe('.dropColumns', () => {
    it('check multiple columns can be dropped', () => {
      [
        [
          Tables.dropColumns(options1),
          `ALTER TABLE "myTableName"
  DROP "colC1",
  DROP "colC2";`,
        ],
        [
          Tables.dropColumns(options2),
          `ALTER TABLE "my_table_name"
  DROP "col_c1",
  DROP "col_c2";`,
        ],
      ].forEach(([fn, res]: [ReturnType<typeof Tables.dropColumns>, string]) => {
        expect(fn('myTableName', ['colC1', 'colC2'])).to.equal(res)
      })
    });
  });

  describe('.addConstraint', () => {
    it('works with strings', () => {
      [
        [
          Tables.addConstraint(options1),
          `ALTER TABLE "myTableName"
  ADD CONSTRAINT "myConstraintName" CHECK name IS NOT NULL;`,
        ],
        [
          Tables.addConstraint(options2),
          `ALTER TABLE "my_table_name"
  ADD CONSTRAINT "my_constraint_name" CHECK name IS NOT NULL;`,
        ],
      ].forEach(([fn, res]: [ReturnType<typeof Tables.addConstraint>, string]) => {
        expect(fn('myTableName', 'myConstraintName', 'CHECK name IS NOT NULL')).to.equal(res)
      })
    });

    it('does not add contraint name if not defined', () => {
      [
        [
          Tables.addConstraint(options1),
          `ALTER TABLE "myTableName"
  ADD CHECK name IS NOT NULL;`,
        ],
        [
          Tables.addConstraint(options2),
          `ALTER TABLE "my_table_name"
  ADD CHECK name IS NOT NULL;`,
        ],
      ].forEach(([fn, res]: [ReturnType<typeof Tables.addConstraint>, string]) => {
        expect(fn('myTableName', null, 'CHECK name IS NOT NULL')).to.equal(res)
      })
    });

    it('can create comments', () => {
      [
        [
          Tables.addConstraint(options1),
          `ALTER TABLE "myTableName"
  ADD CONSTRAINT "myConstraintName" PRIMARY KEY ("colA");
COMMENT ON CONSTRAINT "myConstraintName" ON "myTableName" IS $pg1$this is an important primary key$pg1$;`,
        ],
        [
          Tables.addConstraint(options2),
          `ALTER TABLE "my_table_name"
  ADD CONSTRAINT "my_constraint_name" PRIMARY KEY ("col_a");
COMMENT ON CONSTRAINT "my_constraint_name" ON "my_table_name" IS $pg1$this is an important primary key$pg1$;`,
        ],
      ].forEach(([fn, res]: [ReturnType<typeof Tables.addConstraint>, string]) => {
        expect(fn(
          'myTableName',
          'myConstraintName',
          {
            primaryKey: 'colA',
            comment: 'this is an important primary key'
          }
        )).to.equal(res)
      })
    });
  });
});
