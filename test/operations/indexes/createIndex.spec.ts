import { describe, expect, it } from 'vitest';
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
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "films_title_unique_index" ON "films" ("title") INCLUDE ("director", "rating");'
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
