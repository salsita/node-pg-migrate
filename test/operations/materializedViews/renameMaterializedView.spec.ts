import { describe, expect, it } from 'vitest';
import { renameMaterializedView } from '../../../src/operations/materializedViews';
import { options1, options2 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('materializedViews', () => {
    describe('renameMaterializedView', () => {
      const renameMaterializedViewFn = renameMaterializedView(options1);

      it('should return a function', () => {
        expect(renameMaterializedViewFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renameMaterializedViewFn('foo', 'bar');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER MATERIALIZED VIEW "foo" RENAME TO "bar";'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = renameMaterializedViewFn(
          { name: 'foo', schema: 'myschema' },
          { name: 'bar', schema: 'myschema' }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER MATERIALIZED VIEW "myschema"."foo" RENAME TO "bar";'
        );
      });

      it.each([
        ['new'],
        [{ name: 'new' }],
        [{ schema: 'app', name: 'new' }],
        [{ schema: undefined, name: 'new' }],
      ])('should preserve the source schema with %j', (destination) => {
        const source = { schema: 'app', name: 'old' };
        expect(renameMaterializedViewFn(source, destination)).toBe(
          'ALTER MATERIALIZED VIEW "app"."old" RENAME TO "new";'
        );
        expect(renameMaterializedViewFn.reverse(source, destination)).toBe(
          'ALTER MATERIALIZED VIEW "app"."new" RENAME TO "old";'
        );
      });

      it.each([undefined, ''])(
        'should keep matching %j schemas unqualified',
        (schema) => {
          const source = { schema, name: 'old' };
          const destination = { schema, name: 'new' };
          expect(renameMaterializedViewFn(source, destination)).toBe(
            'ALTER MATERIALIZED VIEW "old" RENAME TO "new";'
          );
          expect(renameMaterializedViewFn.reverse(source, destination)).toBe(
            'ALTER MATERIALIZED VIEW "new" RENAME TO "old";'
          );
        }
      );

      it.each([
        [
          { schema: 'app', name: 'old' },
          { schema: 'other', name: 'new' },
        ],
        ['old', { schema: 'app', name: 'new' }],
        [
          { schema: 'app', name: 'old' },
          { schema: '', name: 'new' },
        ],
        ['old', { schema: '', name: 'new' }],
      ])(
        'should reject incompatible explicit schemas: %j -> %j',
        (source, destination) => {
          const error = new Error(
            'renameMaterializedView cannot change the schema of a materialized view'
          );
          expect(() => renameMaterializedViewFn(source, destination)).toThrow(
            error
          );
          expect(() =>
            renameMaterializedViewFn.reverse(source, destination)
          ).toThrow(error);
        }
      );

      it('should escape schema and object identifiers in both directions', () => {
        const source = { schema: 'my"schema', name: 'old"name' };
        expect(renameMaterializedViewFn(source, 'new"name')).toBe(
          'ALTER MATERIALIZED VIEW "my""schema"."old""name" RENAME TO "new""name";'
        );
        expect(renameMaterializedViewFn.reverse(source, 'new"name')).toBe(
          'ALTER MATERIALIZED VIEW "my""schema"."new""name" RENAME TO "old""name";'
        );
      });

      it('should decamelize both directions and compare schemas before transformation', () => {
        const rename = renameMaterializedView(options2);
        const source = { schema: 'appSchema', name: 'oldName' };
        const destination = { schema: 'appSchema', name: 'newName' };
        expect(rename(source, destination)).toBe(
          'ALTER MATERIALIZED VIEW "app_schema"."old_name" RENAME TO "new_name";'
        );
        expect(rename.reverse(source, destination)).toBe(
          'ALTER MATERIALIZED VIEW "app_schema"."new_name" RENAME TO "old_name";'
        );
        const mismatched = { schema: 'app_schema', name: 'newName' };
        const error = new Error(
          'renameMaterializedView cannot change the schema of a materialized view'
        );
        expect(() => rename(source, mismatched)).toThrow(error);
        expect(() => rename.reverse(source, mismatched)).toThrow(error);
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameMaterializedViewFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameMaterializedViewFn.reverse('foo', 'bar');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER MATERIALIZED VIEW "bar" RENAME TO "foo";'
          );
        });
      });
    });
  });
});
