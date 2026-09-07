import { describe, expect, it } from 'vitest';
import { renameType } from '../../../src/operations/types';
import { options1, options2 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('types', () => {
    describe('renameType', () => {
      const renameTypeFn = renameType(options1);

      it('should return a function', () => {
        expect(renameTypeFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renameTypeFn('electronic_mail', 'email');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TYPE "electronic_mail" RENAME TO "email";'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = renameTypeFn(
          { name: 'electronic_mail', schema: 'myschema' },
          { name: 'email', schema: 'myschema' }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TYPE "myschema"."electronic_mail" RENAME TO "email";'
        );
      });

      it.each([
        ['new'],
        [{ name: 'new' }],
        [{ schema: 'app', name: 'new' }],
        [{ schema: undefined, name: 'new' }],
      ])('should preserve the source schema with %j', (destination) => {
        const source = { schema: 'app', name: 'old' };
        expect(renameTypeFn(source, destination)).toBe(
          'ALTER TYPE "app"."old" RENAME TO "new";'
        );
        expect(renameTypeFn.reverse(source, destination)).toBe(
          'ALTER TYPE "app"."new" RENAME TO "old";'
        );
      });

      it.each([undefined, ''])(
        'should keep matching %j schemas unqualified',
        (schema) => {
          const source = { schema, name: 'old' };
          const destination = { schema, name: 'new' };
          expect(renameTypeFn(source, destination)).toBe(
            'ALTER TYPE "old" RENAME TO "new";'
          );
          expect(renameTypeFn.reverse(source, destination)).toBe(
            'ALTER TYPE "new" RENAME TO "old";'
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
            'renameType cannot change the schema of a type'
          );
          expect(() => renameTypeFn(source, destination)).toThrow(error);
          expect(() => renameTypeFn.reverse(source, destination)).toThrow(
            error
          );
        }
      );

      it('should escape schema and object identifiers in both directions', () => {
        const source = { schema: 'my"schema', name: 'old"name' };
        expect(renameTypeFn(source, 'new"name')).toBe(
          'ALTER TYPE "my""schema"."old""name" RENAME TO "new""name";'
        );
        expect(renameTypeFn.reverse(source, 'new"name')).toBe(
          'ALTER TYPE "my""schema"."new""name" RENAME TO "old""name";'
        );
      });

      it('should decamelize both directions and compare schemas before transformation', () => {
        const rename = renameType(options2);
        const source = { schema: 'appSchema', name: 'oldName' };
        const destination = { schema: 'appSchema', name: 'newName' };
        expect(rename(source, destination)).toBe(
          'ALTER TYPE "app_schema"."old_name" RENAME TO "new_name";'
        );
        expect(rename.reverse(source, destination)).toBe(
          'ALTER TYPE "app_schema"."new_name" RENAME TO "old_name";'
        );
        const mismatched = { schema: 'app_schema', name: 'newName' };
        const error = new Error(
          'renameType cannot change the schema of a type'
        );
        expect(() => rename(source, mismatched)).toThrow(error);
        expect(() => rename.reverse(source, mismatched)).toThrow(error);
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameTypeFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameTypeFn.reverse('electronic_mail', 'email');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER TYPE "email" RENAME TO "electronic_mail";'
          );
        });
      });
    });
  });
});
