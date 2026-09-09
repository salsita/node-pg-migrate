import { describe, expect, it } from 'vitest';
import { renameView } from '../../../src/operations/views';
import { options1, options2 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('views', () => {
    describe('renameView', () => {
      const renameViewFn = renameView(options1);

      it('should return a function', () => {
        expect(renameViewFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renameViewFn('foo', 'bar');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('ALTER VIEW "foo" RENAME TO "bar";');
      });

      it('should return sql statement with schema', () => {
        const statement = renameViewFn(
          { name: 'foo', schema: 'myschema' },
          { name: 'bar', schema: 'myschema' }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('ALTER VIEW "myschema"."foo" RENAME TO "bar";');
      });

      it.each([
        ['new'],
        [{ name: 'new' }],
        [{ schema: 'app', name: 'new' }],
        [{ schema: undefined, name: 'new' }],
      ])('should preserve the source schema with %j', (destination) => {
        const source = { schema: 'app', name: 'old' };
        expect(renameViewFn(source, destination)).toBe(
          'ALTER VIEW "app"."old" RENAME TO "new";'
        );
        expect(renameViewFn.reverse(source, destination)).toBe(
          'ALTER VIEW "app"."new" RENAME TO "old";'
        );
      });

      it.each([undefined, ''])(
        'should keep matching %j schemas unqualified',
        (schema) => {
          const source = { schema, name: 'old' };
          const destination = { schema, name: 'new' };
          expect(renameViewFn(source, destination)).toBe(
            'ALTER VIEW "old" RENAME TO "new";'
          );
          expect(renameViewFn.reverse(source, destination)).toBe(
            'ALTER VIEW "new" RENAME TO "old";'
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
            'renameView cannot change the schema of a view'
          );
          expect(() => renameViewFn(source, destination)).toThrow(error);
          expect(() => renameViewFn.reverse(source, destination)).toThrow(
            error
          );
        }
      );

      it('should escape schema and object identifiers in both directions', () => {
        const source = { schema: 'my"schema', name: 'old"name' };
        expect(renameViewFn(source, 'new"name')).toBe(
          'ALTER VIEW "my""schema"."old""name" RENAME TO "new""name";'
        );
        expect(renameViewFn.reverse(source, 'new"name')).toBe(
          'ALTER VIEW "my""schema"."new""name" RENAME TO "old""name";'
        );
      });

      it('should decamelize both directions and compare schemas before transformation', () => {
        const rename = renameView(options2);
        const source = { schema: 'appSchema', name: 'oldName' };
        const destination = { schema: 'appSchema', name: 'newName' };
        expect(rename(source, destination)).toBe(
          'ALTER VIEW "app_schema"."old_name" RENAME TO "new_name";'
        );
        expect(rename.reverse(source, destination)).toBe(
          'ALTER VIEW "app_schema"."new_name" RENAME TO "old_name";'
        );
        const mismatched = { schema: 'app_schema', name: 'newName' };
        const error = new Error(
          'renameView cannot change the schema of a view'
        );
        expect(() => rename(source, mismatched)).toThrow(error);
        expect(() => rename.reverse(source, mismatched)).toThrow(error);
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameViewFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameViewFn.reverse('foo', 'bar');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('ALTER VIEW "bar" RENAME TO "foo";');
        });
      });
    });
  });
});
