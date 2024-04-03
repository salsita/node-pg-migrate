import { describe, expect, it } from 'vitest';
import { dropSchema } from '../../../src/operations/schemas';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('schemas', () => {
    describe('dropSchema', () => {
      const dropSchemaFn = dropSchema(options1);

      it('should return a function', () => {
        expect(dropSchemaFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropSchemaFn('mystuff');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP SCHEMA "mystuff";');
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropSchemaFn('mystuff', {
          ifExists: true,
          cascade: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP SCHEMA IF EXISTS "mystuff" CASCADE;');
      });
    });
  });
});
