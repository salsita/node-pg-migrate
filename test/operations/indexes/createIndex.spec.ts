import { describe, expect, it } from 'vitest';
import { createIndex } from '../../../src/operations/indexes';
import { options1 } from '../../utils';

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

      it('should throw when passing opclass as last column', () => {
        expect(() =>
          createIndexFn('films', [{ name: 'title', opclass: 'op' }], {
            opclass: 'op',
          })
        ).toThrow(
          new Error(
            "There is already defined opclass on column, can't override it with global one"
          )
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
