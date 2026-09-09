import { describe, expect, it } from 'vitest';
import { renameSequence } from '../../../src/operations/sequences';
import { options1, options2 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('sequences', () => {
    describe('renameSequence', () => {
      const renameSequenceFn = renameSequence(options1);

      it('should return a function', () => {
        expect(renameSequenceFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renameSequenceFn('serial', 'serial2');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('ALTER SEQUENCE "serial" RENAME TO "serial2";');
      });

      it('should return sql statement with schema', () => {
        const statement = renameSequenceFn(
          { name: 'serial', schema: 'myschema' },
          { name: 'serial2', schema: 'myschema' }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER SEQUENCE "myschema"."serial" RENAME TO "serial2";'
        );
      });

      it.each([
        ['new'],
        [{ name: 'new' }],
        [{ schema: 'app', name: 'new' }],
        [{ schema: undefined, name: 'new' }],
      ])('should preserve the source schema with %j', (destination) => {
        const source = { schema: 'app', name: 'old' };
        expect(renameSequenceFn(source, destination)).toBe(
          'ALTER SEQUENCE "app"."old" RENAME TO "new";'
        );
        expect(renameSequenceFn.reverse(source, destination)).toBe(
          'ALTER SEQUENCE "app"."new" RENAME TO "old";'
        );
      });

      it.each([undefined, ''])(
        'should keep matching %j schemas unqualified',
        (schema) => {
          const source = { schema, name: 'old' };
          const destination = { schema, name: 'new' };
          expect(renameSequenceFn(source, destination)).toBe(
            'ALTER SEQUENCE "old" RENAME TO "new";'
          );
          expect(renameSequenceFn.reverse(source, destination)).toBe(
            'ALTER SEQUENCE "new" RENAME TO "old";'
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
            'renameSequence cannot change the schema of a sequence'
          );
          expect(() => renameSequenceFn(source, destination)).toThrow(error);
          expect(() => renameSequenceFn.reverse(source, destination)).toThrow(
            error
          );
        }
      );

      it('should escape schema and object identifiers in both directions', () => {
        const source = { schema: 'my"schema', name: 'old"name' };
        expect(renameSequenceFn(source, 'new"name')).toBe(
          'ALTER SEQUENCE "my""schema"."old""name" RENAME TO "new""name";'
        );
        expect(renameSequenceFn.reverse(source, 'new"name')).toBe(
          'ALTER SEQUENCE "my""schema"."new""name" RENAME TO "old""name";'
        );
      });

      it('should decamelize both directions and compare schemas before transformation', () => {
        const rename = renameSequence(options2);
        const source = { schema: 'appSchema', name: 'oldName' };
        const destination = { schema: 'appSchema', name: 'newName' };
        expect(rename(source, destination)).toBe(
          'ALTER SEQUENCE "app_schema"."old_name" RENAME TO "new_name";'
        );
        expect(rename.reverse(source, destination)).toBe(
          'ALTER SEQUENCE "app_schema"."new_name" RENAME TO "old_name";'
        );
        const mismatched = { schema: 'app_schema', name: 'newName' };
        const error = new Error(
          'renameSequence cannot change the schema of a sequence'
        );
        expect(() => rename(source, mismatched)).toThrow(error);
        expect(() => rename.reverse(source, mismatched)).toThrow(error);
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameSequenceFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameSequenceFn.reverse('serial', 'serial2');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER SEQUENCE "serial2" RENAME TO "serial";'
          );
        });
      });
    });
  });
});
