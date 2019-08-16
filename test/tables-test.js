const { expect } = require("chai");
const Tables = require("../lib/operations/tables");

describe("lib/operations/tables", () => {
  describe(".create", () => {
    it("check schemas can be used", () => {
      const sql = Tables.createTable()(
        { schema: "my_schema", name: "my_table_name" },
        { id: "serial" }
      );
      expect(sql).to.equal(`CREATE TABLE "my_schema"."my_table_name" (
  "id" serial
);`);
    });

    it("check shorthands work", () => {
      const sql = Tables.createTable()("my_table_name", { id: "id" });
      expect(sql).to.equal(`CREATE TABLE "my_table_name" (
  "id" serial PRIMARY KEY
);`);
    });

    it("check custom shorthands can be used", () => {
      const sql = Tables.createTable({
        id: { type: "uuid", primaryKey: true }
      })("my_table_name", { id: "id" });
      expect(sql).to.equal(`CREATE TABLE "my_table_name" (
  "id" uuid PRIMARY KEY
);`);
    });

    it("check schemas can be used for foreign keys", () => {
      const sql = Tables.createTable()("my_table_name", {
        parent_id: {
          type: "integer",
          references: { schema: "a", name: "b" }
        }
      });
      expect(sql).to.equal(`CREATE TABLE "my_table_name" (
  "parent_id" integer REFERENCES "a"."b"
);`);
    });

    it("check match clause can be used for foreign keys", () => {
      const sql = Tables.createTable()("my_table_name", {
        parent_id: {
          type: "integer",
          references: { schema: "a", name: "b" },
          match: "SIMPLE"
        }
      });
      expect(sql).to.equal(`CREATE TABLE "my_table_name" (
  "parent_id" integer REFERENCES "a"."b" MATCH SIMPLE
);`);
    });

    it("check defining column can be used for foreign keys", () => {
      const sql = Tables.createTable()("my_table_name", {
        parent_id: { type: "integer", references: "a.b(id)" }
      });
      expect(sql).to.equal(`CREATE TABLE "my_table_name" (
  "parent_id" integer REFERENCES a.b(id)
);`);
    });

    it("check multicolumn primary key name does not include schema", () => {
      const sql = Tables.createTable()(
        { schema: "s", name: "my_table_name" },
        {
          a: { type: "integer", primaryKey: true },
          b: { type: "varchar", primaryKey: true }
        }
      );
      expect(sql).to.equal(`CREATE TABLE "s"."my_table_name" (
  "a" integer,
  "b" varchar,
  CONSTRAINT "my_table_name_pkey" PRIMARY KEY ("a", "b")
);`);
    });

    it("check table references work correctly", () => {
      const sql = Tables.createTable()(
        "my_table_name",
        {
          a: { type: "integer" },
          b: { type: "varchar" }
        },
        {
          constraints: {
            foreignKeys: [
              {
                columns: ["a", "b"],
                references: "otherTable (A, B)"
              }
            ]
          }
        }
      );
      expect(sql).to.equal(`CREATE TABLE "my_table_name" (
  "a" integer,
  "b" varchar,
  CONSTRAINT "my_table_name_fk_a_b" FOREIGN KEY ("a", "b") REFERENCES otherTable (A, B)
);`);
    });

    it("check table unique constraint work correctly", () => {
      const sql = Tables.createTable()(
        "my_table_name",
        {
          a: { type: "integer" },
          b: { type: "varchar" }
        },
        {
          constraints: {
            unique: ["a", "b"]
          }
        }
      );
      expect(sql).to.equal(`CREATE TABLE "my_table_name" (
  "a" integer,
  "b" varchar,
  CONSTRAINT "my_table_name_uniq_a_b" UNIQUE ("a", "b")
);`);
    });

    it("check table unique constraint work correctly for array of arrays", () => {
      const sql = Tables.createTable()(
        "my_table_name",
        {
          a: { type: "integer" },
          b: { type: "varchar" },
          c: { type: "varchar" }
        },
        {
          constraints: {
            unique: [["a", "b"], "c"]
          }
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

    it("creates comments on foreign keys", () => {
      const sql = Tables.createTable()(
        "my_table_name",
        {
          a: { type: "integer" }
        },
        {
          constraints: {
            foreignKeys: {
              columns: ["a"],
              references: "other_table",
              referencesConstraintComment: "example comment"
            }
          }
        }
      );
      expect(sql).to.equal(`CREATE TABLE "my_table_name" (
  "a" integer,
  CONSTRAINT "my_table_name_fk_a" FOREIGN KEY ("a") REFERENCES "other_table"
);
COMMENT ON CONSTRAINT "my_table_name_fk_a" ON "my_table_name" IS $pg1$example comment$pg1$;`);
    });

    it("creates comments on column foreign keys", () => {
      const sql = Tables.createTable()("my_table_name", {
        a: {
          type: "integer",
          references: "other_table (a)",
          referencesConstraintComment: "fk a comment"
        },
        b: {
          type: "integer",
          references: "other_table_two",
          referencesConstraintName: "fk_b",
          referencesConstraintComment: "fk b comment"
        }
      });
      expect(sql).to.equal(`CREATE TABLE "my_table_name" (
  "a" integer CONSTRAINT "my_table_name_fk_a" REFERENCES other_table (a),
  "b" integer CONSTRAINT "fk_b" REFERENCES "other_table_two"
);
COMMENT ON CONSTRAINT "my_table_name_fk_a" ON "my_table_name" IS $pg1$fk a comment$pg1$;
COMMENT ON CONSTRAINT "fk_b" ON "my_table_name" IS $pg1$fk b comment$pg1$;`);
    });

    it("creates no comments on unnamed constraints", () => {
      expect(() =>
        Tables.createTable()(
          "my_table_name",
          {
            a: { type: "integer" }
          },
          {
            constraints: {
              primaryKey: "a",
              comment: "example comment"
            }
          }
        )
      ).to.throw("cannot comment on unspecified constraints");
    });
  });

  describe(".dropColumns", () => {
    it("check multiple columns can be dropped", () => {
      const sql = Tables.dropColumns("my_table_name", ["c1", "c2"]);
      expect(sql).to.equal(`ALTER TABLE "my_table_name"
  DROP "c1",
  DROP "c2";`);
    });
  });

  describe(".addConstraint", () => {
    it("can create comments", () => {
      const sql = Tables.addConstraint("my_table", "my_constraint_name", {
        primaryKey: "a",
        comment: "this is an important primary key"
      });
      expect(sql).to.equal(`ALTER TABLE "my_table"
  ADD CONSTRAINT "my_constraint_name" PRIMARY KEY ("a");
COMMENT ON CONSTRAINT "my_constraint_name" ON "my_table" IS $pg1$this is an important primary key$pg1$;`);
    });
  });
});
