import { describe, expect, it } from 'vitest';
import { PgType } from '../../../src';
import { createTable } from '../../../src/operations/tables';
import { options1, options2 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('tables', () => {
    describe('createTable', () => {
      const createTableFn = createTable(options1);

      it('should return a function', () => {
        expect(createTableFn).toBeTypeOf('function');
      });

      // TODO @Shinigami92 2024-03-12: This should throw an error when columns are empty
      it('should return sql statement', () => {
        const statement = createTableFn('films', {});

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('CREATE TABLE "films" (\n  \n);');
      });

      it('should return sql statement with tableOptions', () => {
        const statement = createTableFn('films', {
          code: {
            type: 'char(5)',
            primaryKey: true,
          },
          title: {
            type: 'varchar(40)',
            notNull: true,
          },
          did: {
            type: PgType.INTEGER,
            notNull: true,
          },
          date_prod: PgType.DATE,
          kind: 'varchar(10)',
          len: {
            type: 'interval hour to minute',
          },
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `CREATE TABLE "films" (
  "code" char(5) PRIMARY KEY,
  "title" varchar(40) NOT NULL,
  "did" integer NOT NULL,
  "date_prod" date,
  "kind" varchar(10),
  "len" interval hour to minute
);`
        );
      });

      // TODO @Shinigami92 2024-03-12: This should throw an error when columns are empty
      it('should return sql statement with schema', () => {
        const statement = createTableFn(
          {
            name: 'films',
            schema: 'myschema',
          },
          {}
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('CREATE TABLE "myschema"."films" (\n  \n);');
      });

      it.each([
        // should use schemas
        [
          'should use schemas 1',
          options1,
          [
            { schema: 'mySchema', name: 'myTableName' },
            { idColumn: 'serial' },
            undefined,
          ],
          `CREATE TABLE "mySchema"."myTableName" (
  "idColumn" serial
);`,
        ],
        [
          'should use schemas 2',
          options2,
          [
            { schema: 'mySchema', name: 'myTableName' },
            { idColumn: 'serial' },
            undefined,
          ],
          `CREATE TABLE "my_schema"."my_table_name" (
  "id_column" serial
);`,
        ],
        // should work with shorthands
        [
          'should work with shorthands 1',
          options1,
          ['myTableName', { idColumn: 'id' }, undefined],
          `CREATE TABLE "myTableName" (
  "idColumn" serial PRIMARY KEY
);`,
        ],
        [
          'should work with shorthands 2',
          options2,
          ['myTableName', { idColumn: 'id' }, undefined],
          `CREATE TABLE "my_table_name" (
  "id_column" serial PRIMARY KEY
);`,
        ],
        // should use custom shorthands
        [
          'should use custom shorthands 1',
          {
            ...options1,
            typeShorthands: {
              ...options1.typeShorthands,
              idTest: { type: 'uuid', primaryKey: true },
            },
          },
          ['myTableName', { idColumn: 'idTest' }, undefined],
          `CREATE TABLE "myTableName" (
  "idColumn" uuid PRIMARY KEY
);`,
        ],
        [
          'should use custom shorthands 2',
          {
            ...options2,
            typeShorthands: {
              ...options2.typeShorthands,
              idTest: { type: 'uuid', primaryKey: true },
            },
          },
          ['myTableName', { idColumn: 'idTest' }, undefined],
          `CREATE TABLE "my_table_name" (
  "id_column" uuid PRIMARY KEY
);`,
        ],
        // should use schemas with foreign keys
        [
          'should use schemas with foreign keys 1',
          options1,
          [
            'myTableName',
            {
              parentId: {
                type: 'integer',
                references: { schema: 'schemaA', name: 'tableB' },
              },
            },
            undefined,
          ],
          `CREATE TABLE "myTableName" (
  "parentId" integer REFERENCES "schemaA"."tableB"
);`,
        ],
        [
          'should use schemas with foreign keys 2',
          options2,
          [
            'myTableName',
            {
              parentId: {
                type: 'integer',
                references: { schema: 'schemaA', name: 'tableB' },
              },
            },
            undefined,
          ],
          `CREATE TABLE "my_table_name" (
  "parent_id" integer REFERENCES "schema_a"."table_b"
);`,
        ],
        // should match clause can be used for foreign keys
        [
          'should match clause can be used for foreign keys 1',
          options1,
          [
            'myTableName',
            {
              parentId: {
                type: 'integer',
                references: { schema: 'schemaA', name: 'tableB' },
                match: 'SIMPLE',
              },
            },
            undefined,
          ],
          `CREATE TABLE "myTableName" (
  "parentId" integer REFERENCES "schemaA"."tableB" MATCH SIMPLE
);`,
        ],
        [
          'should match clause can be used for foreign keys 2',
          options2,
          [
            'myTableName',
            {
              parentId: {
                type: 'integer',
                references: { schema: 'schemaA', name: 'tableB' },
                match: 'SIMPLE',
              },
            },
            undefined,
          ],
          `CREATE TABLE "my_table_name" (
  "parent_id" integer REFERENCES "schema_a"."table_b" MATCH SIMPLE
);`,
        ],
        // should check defining column can be used for foreign keys
        [
          'should check defining column can be used for foreign keys 1',
          options1,
          [
            'myTableName',
            {
              parentId: {
                type: 'integer',
                references: 'schemaA.tableB(idColumn)',
              },
            },
            undefined,
          ],
          `CREATE TABLE "myTableName" (
  "parentId" integer REFERENCES schemaA.tableB(idColumn)
);`,
        ],
        [
          'should check defining column can be used for foreign keys 2',
          options2,
          [
            'myTableName',
            {
              parentId: {
                type: 'integer',
                references: 'schemaA.tableB(idColumn)',
              },
            },
            undefined,
          ],
          `CREATE TABLE "my_table_name" (
  "parent_id" integer REFERENCES schemaA.tableB(idColumn)
);`,
        ],
        // should include multi-column primary key
        [
          'should include multi-column primary key 1',
          options1,
          [
            { schema: 'mySchema', name: 'myTableName' },
            {
              colA: { type: 'integer', primaryKey: true },
              colB: { type: 'varchar', primaryKey: true },
            },
            undefined,
          ],
          `CREATE TABLE "mySchema"."myTableName" (
  "colA" integer,
  "colB" varchar,
  CONSTRAINT "myTableName_pkey" PRIMARY KEY ("colA", "colB")
);`,
        ],
        [
          'should include multi-column primary key 2',
          options2,
          [
            { schema: 'mySchema', name: 'myTableName' },
            {
              colA: { type: 'integer', primaryKey: true },
              colB: { type: 'varchar', primaryKey: true },
            },
            undefined,
          ],
          `CREATE TABLE "my_schema"."my_table_name" (
  "col_a" integer,
  "col_b" varchar,
  CONSTRAINT "my_table_name_pkey" PRIMARY KEY ("col_a", "col_b")
);`,
        ],
        // should check table references work correctly
        [
          'should check table references work correctly 1',
          options1,
          [
            'myTableName',
            { colA: { type: 'integer' }, colB: { type: 'varchar' } },
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
          ],
          `CREATE TABLE "myTableName" (
  "colA" integer,
  "colB" varchar,
  CONSTRAINT "myTableName_fk_colA_colB" FOREIGN KEY ("colA", "colB") REFERENCES otherTable (A, B)
);`,
        ],
        [
          'should check table references work correctly 2',
          options2,
          [
            'myTableName',
            { colA: { type: 'integer' }, colB: { type: 'varchar' } },
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
          ],
          `CREATE TABLE "my_table_name" (
  "col_a" integer,
  "col_b" varchar,
  CONSTRAINT "my_table_name_fk_col_a_col_b" FOREIGN KEY ("col_a", "col_b") REFERENCES otherTable (A, B)
);`,
        ],
        // should check table unique constraint work correctly
        [
          'should check table unique constraint work correctly 1',
          options1,
          [
            'myTableName',
            { colA: { type: 'integer' }, colB: { type: 'varchar' } },
            { constraints: { unique: ['colA', 'colB'] } },
          ],
          `CREATE TABLE "myTableName" (
  "colA" integer,
  "colB" varchar,
  CONSTRAINT "myTableName_uniq_colA_colB" UNIQUE ("colA", "colB")
);`,
        ],
        [
          'should check table unique constraint work correctly 2',
          options2,
          [
            'myTableName',
            { colA: { type: 'integer' }, colB: { type: 'varchar' } },
            { constraints: { unique: ['colA', 'colB'] } },
          ],
          `CREATE TABLE "my_table_name" (
  "col_a" integer,
  "col_b" varchar,
  CONSTRAINT "my_table_name_uniq_col_a_col_b" UNIQUE ("col_a", "col_b")
);`,
        ],
        // should check table unique constraint work correctly for string
        [
          'should check table unique constraint work correctly for string 1',
          options1,
          [
            'myTableName',
            { colA: { type: 'integer' }, colB: { type: 'varchar' } },
            { constraints: { unique: 'colA' } },
          ],
          `CREATE TABLE "myTableName" (
  "colA" integer,
  "colB" varchar,
  CONSTRAINT "myTableName_uniq_colA" UNIQUE ("colA")
);`,
        ],
        [
          'should check table unique constraint work correctly for string 2',
          options2,
          [
            'myTableName',
            { colA: { type: 'integer' }, colB: { type: 'varchar' } },
            { constraints: { unique: 'colA' } },
          ],
          `CREATE TABLE "my_table_name" (
  "col_a" integer,
  "col_b" varchar,
  CONSTRAINT "my_table_name_uniq_col_a" UNIQUE ("col_a")
);`,
        ],
        // should check table unique constraint work correctly for array of arrays
        [
          'should check table unique constraint work correctly for array of arrays 1',
          options1,
          [
            'myTableName',
            {
              colA: { type: 'integer' },
              colB: { type: 'varchar' },
              colC: { type: 'varchar' },
            },
            {
              constraints: { unique: [['colA', 'colB'], 'colC'] },
            },
          ],
          `CREATE TABLE "myTableName" (
  "colA" integer,
  "colB" varchar,
  "colC" varchar,
  CONSTRAINT "myTableName_uniq_colA_colB" UNIQUE ("colA", "colB"),
  CONSTRAINT "myTableName_uniq_colC" UNIQUE ("colC")
);`,
        ],
        [
          'should check table unique constraint work correctly for array of arrays 2',
          options2,
          [
            'myTableName',
            {
              colA: { type: 'integer' },
              colB: { type: 'varchar' },
              colC: { type: 'varchar' },
            },
            {
              constraints: { unique: [['colA', 'colB'], 'colC'] },
            },
          ],
          `CREATE TABLE "my_table_name" (
  "col_a" integer,
  "col_b" varchar,
  "col_c" varchar,
  CONSTRAINT "my_table_name_uniq_col_a_col_b" UNIQUE ("col_a", "col_b"),
  CONSTRAINT "my_table_name_uniq_col_c" UNIQUE ("col_c")
);`,
        ],
        // should create comments on foreign keys
        [
          'should create comments on foreign keys 1',
          options1,
          [
            'myTableName',
            { colA: { type: 'integer' } },
            {
              constraints: {
                foreignKeys: {
                  columns: ['colA'],
                  references: 'otherTable',
                  referencesConstraintComment: 'example comment',
                },
              },
            },
          ],
          `CREATE TABLE "myTableName" (
  "colA" integer,
  CONSTRAINT "myTableName_fk_colA" FOREIGN KEY ("colA") REFERENCES "otherTable"
);
COMMENT ON CONSTRAINT "myTableName_fk_colA" ON "myTableName" IS $pga$example comment$pga$;`,
        ],
        [
          'should create comments on foreign keys 2',
          options2,
          [
            'myTableName',
            { colA: { type: 'integer' } },
            {
              constraints: {
                foreignKeys: {
                  columns: ['colA'],
                  references: 'otherTable',
                  referencesConstraintComment: 'example comment',
                },
              },
            },
          ],
          `CREATE TABLE "my_table_name" (
  "col_a" integer,
  CONSTRAINT "my_table_name_fk_col_a" FOREIGN KEY ("col_a") REFERENCES "other_table"
);
COMMENT ON CONSTRAINT "my_table_name_fk_col_a" ON "my_table_name" IS $pga$example comment$pga$;`,
        ],
        // should create comments on column foreign keys
        [
          'should create comments on column foreign keys 1',
          options1,
          [
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
          ],
          `CREATE TABLE "myTableName" (
  "colA" integer CONSTRAINT "myTableName_fk_colA" REFERENCES otherTable (a),
  "colB" integer CONSTRAINT "fkColB" REFERENCES "otherTableTwo"
);
COMMENT ON CONSTRAINT "myTableName_fk_colA" ON "myTableName" IS $pga$fk a comment$pga$;
COMMENT ON CONSTRAINT "fkColB" ON "myTableName" IS $pga$fk b comment$pga$;`,
        ],
        [
          'should create comments on column foreign keys 2',
          options2,
          [
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
          ],
          `CREATE TABLE "my_table_name" (
  "col_a" integer CONSTRAINT "my_table_name_fk_col_a" REFERENCES otherTable (a),
  "col_b" integer CONSTRAINT "fk_col_b" REFERENCES "other_table_two"
);
COMMENT ON CONSTRAINT "my_table_name_fk_col_a" ON "my_table_name" IS $pga$fk a comment$pga$;
COMMENT ON CONSTRAINT "fk_col_b" ON "my_table_name" IS $pga$fk b comment$pga$;`,
        ],
        // Add to the existing it.each array:
        [
          'should support RANGE partitioning',
          options1,
          [
            'events',
            {
              id: 'serial',
              created_at: 'timestamp',
              data: 'jsonb',
            },
            {
              partition: {
                strategy: 'RANGE',
                columns: 'created_at',
              },
            },
          ],
          `CREATE TABLE "events" (
  "id" serial,
  "created_at" timestamp,
  "data" jsonb
) PARTITION BY RANGE ("created_at");`,
        ],
        [
          'should support LIST partitioning with multiple columns',
          options1,
          [
            'metrics',
            {
              id: 'serial',
              region: 'text',
              category: 'text',
              value: 'numeric',
            },
            {
              partition: {
                strategy: 'LIST',
                columns: ['region', 'category'],
              },
            },
          ],
          `CREATE TABLE "metrics" (
  "id" serial,
  "region" text,
  "category" text,
  "value" numeric
) PARTITION BY LIST ("region", "category");`,
        ],
        [
          'should support HASH partitioning with operator class',
          options1,
          [
            'users',
            {
              id: 'uuid',
              email: 'text',
              name: 'text',
            },
            {
              partition: {
                strategy: 'HASH',
                columns: { name: 'id', opclass: 'hash_extension.uuid_ops' },
              },
            },
          ],
          `CREATE TABLE "users" (
  "id" uuid,
  "email" text,
  "name" text
) PARTITION BY HASH ("id" hash_extension.uuid_ops);`,
        ],
        [
          'should support partitioning with INHERITS',
          options1,
          [
            'child_events',
            {
              id: 'serial',
              created_at: 'timestamp',
            },
            {
              inherits: 'parent_events',
              partition: {
                strategy: 'RANGE',
                columns: 'created_at',
              },
            },
          ],
          `CREATE TABLE "child_events" (
  "id" serial,
  "created_at" timestamp
) INHERITS ("parent_events") PARTITION BY RANGE ("created_at");`,
        ],
        [
          'should handle snake case naming with partitioning',
          options2,
          [
            'userMetrics',
            {
              userId: 'uuid',
              eventType: 'text',
              createdAt: 'timestamp',
            },
            {
              partition: {
                strategy: 'LIST',
                columns: 'event_type',
              },
            },
          ],
          `CREATE TABLE "user_metrics" (
  "user_id" uuid,
  "event_type" text,
  "created_at" timestamp
) PARTITION BY LIST ("event_type");`,
        ],
        [
          'should support partitioning with collation',
          options1,
          [
            'posts',
            {
              id: 'serial',
              title: 'text',
              language: 'text',
            },
            {
              partition: {
                strategy: 'LIST',
                columns: { name: 'language', collate: 'en_US' },
              },
            },
          ],
          `CREATE TABLE "posts" (
  "id" serial,
  "title" text,
  "language" text
) PARTITION BY LIST ("language" COLLATE en_US);`,
        ],
      ] as const)(
        '%s',
        (_, optionPreset, [tableName, columns, options], expected) => {
          const createTableFn = createTable(optionPreset);
          const statement = createTableFn(
            tableName,
            columns,
            // @ts-expect-error: ignore readonly
            options
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(expected);
        }
      );

      it.each([
        // should throw on create comments on unnamed constraints
        [
          'should throw on create comments on unnamed constraints 1',
          options1,
          [
            'myTableName',
            { colA: { type: 'integer' } },
            { constraints: { primaryKey: 'colA', comment: 'example comment' } },
          ],
          new Error('cannot comment on unspecified constraints'),
        ],
        [
          'should throw on create comments on unnamed constraints 2',
          options2,
          [
            'myTableName',
            { colA: { type: 'integer' } },
            { constraints: { primaryKey: 'colA', comment: 'example comment' } },
          ],
          new Error('cannot comment on unspecified constraints'),
        ],
      ] as const)(
        '%s',
        (_, optionPreset, [tableName, columns, options], expected) => {
          const createTableFn = createTable(optionPreset);

          expect(() => createTableFn(tableName, columns, options)).toThrow(
            expected
          );
        }
      );

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(createTableFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = createTableFn.reverse('films', {});

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('DROP TABLE "films";');
        });
      });
    });
  });
});
