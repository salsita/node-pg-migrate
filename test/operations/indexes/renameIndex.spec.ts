import { describe, expect, it } from 'vitest';
import { renameIndex } from '../../../src/operations/indexes';
import { options1, options2 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('indexes', () => {
    describe('renameIndex', () => {
      const renameIndexFn = renameIndex(options1);

      it('should return a function', () => {
        expect(renameIndexFn).toBeTypeOf('function');
      });

      it('should generate correct SQL for renaming an index', () => {
        const statement = renameIndexFn('my_index', 'new_index');
        expect(statement).toBe('ALTER INDEX "my_index" RENAME TO "new_index";');
      });

      it.each([
        ['new'],
        [{ name: 'new' }],
        [{ schema: 'app', name: 'new' }],
        [{ schema: undefined, name: 'new' }],
      ])('should preserve the source schema with %j', (destination) => {
        const source = { schema: 'app', name: 'old' };
        expect(renameIndexFn(source, destination)).toBe(
          'ALTER INDEX "app"."old" RENAME TO "new";'
        );
        expect(renameIndexFn.reverse(source, destination)).toBe(
          'ALTER INDEX "app"."new" RENAME TO "old";'
        );
      });

      it.each([undefined, ''])(
        'should keep matching %j schemas unqualified',
        (schema) => {
          const source = { schema, name: 'old' };
          const destination = { schema, name: 'new' };
          expect(renameIndexFn(source, destination)).toBe(
            'ALTER INDEX "old" RENAME TO "new";'
          );
          expect(renameIndexFn.reverse(source, destination)).toBe(
            'ALTER INDEX "new" RENAME TO "old";'
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
            'renameIndex cannot change the schema of an index'
          );
          expect(() => renameIndexFn(source, destination)).toThrow(error);
          expect(() => renameIndexFn.reverse(source, destination)).toThrow(
            error
          );
        }
      );

      it('should escape schema and object identifiers in both directions', () => {
        const source = { schema: 'my"schema', name: 'old"name' };
        expect(renameIndexFn(source, 'new"name')).toBe(
          'ALTER INDEX "my""schema"."old""name" RENAME TO "new""name";'
        );
        expect(renameIndexFn.reverse(source, 'new"name')).toBe(
          'ALTER INDEX "my""schema"."new""name" RENAME TO "old""name";'
        );
      });

      it('should decamelize both directions and compare schemas before transformation', () => {
        const rename = renameIndex(options2);
        const source = { schema: 'appSchema', name: 'oldName' };
        const destination = { schema: 'appSchema', name: 'newName' };
        expect(rename(source, destination)).toBe(
          'ALTER INDEX "app_schema"."old_name" RENAME TO "new_name";'
        );
        expect(rename.reverse(source, destination)).toBe(
          'ALTER INDEX "app_schema"."new_name" RENAME TO "old_name";'
        );
        const mismatched = { schema: 'app_schema', name: 'newName' };
        const error = new Error(
          'renameIndex cannot change the schema of an index'
        );
        expect(() => rename(source, mismatched)).toThrow(error);
        expect(() => rename.reverse(source, mismatched)).toThrow(error);
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameIndexFn.reverse).toBeTypeOf('function');
        });

        it('should generate correct SQL for reversing the rename operation', () => {
          const reverseStatement = renameIndexFn.reverse(
            'my_index',
            'new_index'
          );
          expect(reverseStatement).toBe(
            'ALTER INDEX "new_index" RENAME TO "my_index";'
          );
        });
      });
    });
  });
});
