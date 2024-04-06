import { describe, expect, it } from 'vitest';
import { createSchema } from '../../../src/operations/schemas';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('schemas', () => {
    describe('createSchema', () => {
      const createSchemaFn = createSchema(options1);

      it('should return a function', () => {
        expect(createSchemaFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = createSchemaFn('myschema');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('CREATE SCHEMA "myschema";');
      });

      it('should return sql statement with schemaOptions', () => {
        const statement = createSchemaFn('test', {
          ifNotExists: true,
          authorization: 'joe',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE SCHEMA IF NOT EXISTS "test" AUTHORIZATION joe;'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(createSchemaFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = createSchemaFn.reverse('myschema');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('DROP SCHEMA "myschema";');
        });
      });
    });
  });
});
