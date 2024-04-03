import { describe, expect, it } from 'vitest';
import { renameSchema } from '../../../src/operations/schemas';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('schemas', () => {
    describe('renameSchema', () => {
      const renameSchemaFn = renameSchema(options1);

      it('should return a function', () => {
        expect(renameSchemaFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renameSchemaFn('test', 'myschema');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('ALTER SCHEMA "test" RENAME TO "myschema";');
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameSchemaFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameSchemaFn.reverse('test', 'myschema');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('ALTER SCHEMA "myschema" RENAME TO "test";');
        });
      });
    });
  });
});
