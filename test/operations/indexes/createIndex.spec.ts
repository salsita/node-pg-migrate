import { describe, expect, it } from 'vitest';
import { PgLiteral } from '../../../src';
import { createIndex } from '../../../src/operations/indexes';
import { options1, options2 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('indexes', () => {
    describe('createIndex', () => {
      const createIndexFn = createIndex(options1);

      it('should return a function', () => {
        expect(createIndexFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = createIndexFn('films', ['title'], {
          name: 'title_idx',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE INDEX "title_idx" ON "films" ("title");'
        );
      });

      it('should return sql statement with indexOptions', () => {
        const statement = createIndexFn('films', 'title', {
          unique: true,
          concurrently: true,
          ifNotExists: true,
          include: ['director', 'rating'],
          nulls: 'not distinct',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "films_title_unique_index" ON "films" ("title") INCLUDE ("director", "rating") NULLS NOT DISTINCT;'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = createIndexFn({ name: 'films', schema: 'myschema' }, [
          { name: 'title', sort: 'ASC' },
        ]);

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE INDEX "films_title_index" ON "myschema"."films" ("title" ASC);'
        );
      });

      it.each([
        // should check schema not included in index name
        [
          'should check schema not included in index name 1',
          options1,
          [{ schema: 'mySchema', name: 'myTable' }, ['colA', 'colB']],
          'CREATE INDEX "myTable_colA_colB_index" ON "mySchema"."myTable" ("colA", "colB");',
        ],
        [
          'should check schema not included in index name 2',
          options2,
          [{ schema: 'mySchema', name: 'myTable' }, ['colA', 'colB']],
          'CREATE INDEX "my_table_col_a_col_b_index" ON "my_schema"."my_table" ("col_a", "col_b");',
        ],
        // should add opclass option
        [
          'should add opclass option 1',
          options1,
          [
            'xTable',
            [
              {
                name: 'yName',
                opclass: { schema: 'someSchema', name: 'someOpclass' },
              },
            ],
            {
              method: 'gist',
              name: 'zIndex',
              where: 'some condition',
            },
          ],
          'CREATE INDEX "zIndex" ON "xTable" USING gist ("yName" "someSchema"."someOpclass") WHERE some condition;',
        ],
        [
          'should add opclass option 2',
          options2,
          [
            'xTable',
            [
              {
                name: 'yName',
                opclass: { schema: 'someSchema', name: 'someOpclass' },
              },
            ],
            {
              method: 'gist',
              name: 'zIndex',
              where: 'some condition',
            },
          ],
          'CREATE INDEX "z_index" ON "x_table" USING gist ("y_name" "some_schema"."some_opclass") WHERE some condition;',
        ],
        // should add sort option
        [
          'should add sort option 1',
          options1,
          [
            'xTable',
            [{ name: 'yName', sort: 'DESC' }],
            {
              method: 'gist',
              name: 'zIndex',
              where: 'some condition',
            },
          ],
          'CREATE INDEX "zIndex" ON "xTable" USING gist ("yName" DESC) WHERE some condition;',
        ],
        [
          'should add sort option 2',
          options2,
          [
            'xTable',
            [{ name: 'yName', sort: 'DESC' }],
            {
              method: 'gist',
              name: 'zIndex',
              where: 'some condition',
            },
          ],
          'CREATE INDEX "z_index" ON "x_table" USING gist ("y_name" DESC) WHERE some condition;',
        ],
        // should add include option
        [
          'should add include option 1',
          options1,
          ['xTable', ['yName'], { name: 'zIndex', include: 'someOtherColumn' }],
          'CREATE INDEX "zIndex" ON "xTable" ("yName") INCLUDE ("someOtherColumn");',
        ],
        [
          'should add include option 2',
          options2,
          ['xTable', ['yName'], { name: 'zIndex', include: 'someOtherColumn' }],
          'CREATE INDEX "z_index" ON "x_table" ("y_name") INCLUDE ("some_other_column");',
        ],
        // should add nulls option
        [
          'should add nulls option 1',
          options1,
          [
            'xTable',
            ['yName'],
            { name: 'zIndex', unique: true, nulls: 'distinct' },
          ],
          'CREATE UNIQUE INDEX "zIndex" ON "xTable" ("yName") NULLS DISTINCT;',
        ],
        [
          'should add nulls option 2',
          options2,
          [
            'xTable',
            ['yName'],
            { name: 'zIndex', unique: true, nulls: 'not distinct' },
          ],
          'CREATE UNIQUE INDEX "z_index" ON "x_table" ("y_name") NULLS NOT DISTINCT;',
        ],
      ] as const)(
        '%s',
        (_, optionPreset, [tableName, columns, options], expected) => {
          const createIndexFn = createIndex(optionPreset);
          const statement = createIndexFn(
            tableName,
            // @ts-expect-error: ignore readonly
            columns,
            options
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(expected);
        }
      );

      it('should throw an error if nulls option is used without unique index', () => {
        expect(() =>
          createIndexFn('films', ['title'], { nulls: 'distinct' })
        ).toThrowError(
          'The "nulls" option can only be used with unique indexes.'
        );
      });

      it('should create index with JSON operator expression', () => {
        const statement = createIndexFn('functions', "contentSub->>'id'", {
          name: 'functions_contentsub_id_idx',
        });
        expect(statement).toBe(
          'CREATE INDEX "functions_contentsub_id_idx" ON "functions" ((contentSub->>\'id\'));'
        );
      });

      it('should create index with expression and WHERE clause', () => {
        const statement = createIndexFn('functions', "contentSub->>'id'", {
          name: 'functions_contentsub_id_idx',
          where: `"deletedAt" IS NULL AND contentSub->>'id' IS NOT NULL`,
        });
        expect(statement).toBe(
          'CREATE INDEX "functions_contentsub_id_idx" ON "functions" ((contentSub->>\'id\')) WHERE "deletedAt" IS NULL AND contentSub->>\'id\' IS NOT NULL;'
        );
      });

      it('should create function-based index', () => {
        const statement = createIndexFn('users', 'lower(email)', {
          name: 'users_email_lower_idx',
        });
        expect(statement).toBe(
          'CREATE INDEX "users_email_lower_idx" ON "users" ((lower(email)));'
        );
      });

      it('should create index with cast expression', () => {
        const statement = createIndexFn('events', 'created_at::date', {
          name: 'events_created_date_idx',
        });
        expect(statement).toBe(
          'CREATE INDEX "events_created_date_idx" ON "events" ((created_at::date));'
        );
      });

      it('should create index with arithmetic expression', () => {
        const statement = createIndexFn('metrics', 'value * 100', {
          name: 'metrics_value_scaled_idx',
        });
        expect(statement).toBe(
          'CREATE INDEX "metrics_value_scaled_idx" ON "metrics" ((value * 100));'
        );
      });

      it('should create index with multiple expressions', () => {
        const statement = createIndexFn(
          'docs',
          ["meta->>'type'", "meta->>'version'"],
          {
            name: 'docs_meta_type_version_idx',
          }
        );
        expect(statement).toBe(
          'CREATE INDEX "docs_meta_type_version_idx" ON "docs" ((meta->>\'type\'), (meta->>\'version\'));'
        );
      });

      it('should create index with mixed column and expression', () => {
        const statement = createIndexFn(
          'docs',
          ['owner_id', "meta->>'type'"],
          { name: 'docs_owner_type_idx' }
        );
        expect(statement).toBe(
          'CREATE INDEX "docs_owner_type_idx" ON "docs" ("owner_id", (meta->>\'type\'));'
        );
      });

      it('should create index with explicit pgm.sql (regression test)', () => {
        const statement = createIndexFn(
          'functions',
          // @ts-expect-error: regression test for pgm.sql
          PgLiteral.create("(contentSub->>'id')"),
          { name: 'functions_expr_sql_idx' }
        );
        expect(statement).toBe(
          'CREATE INDEX "functions_expr_sql_idx" ON "functions" ((contentSub->>\'id\'));'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(createIndexFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = createIndexFn.reverse('films', ['title']);

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('DROP INDEX "films_title_index";');
        });
      });
    });
  });
});
