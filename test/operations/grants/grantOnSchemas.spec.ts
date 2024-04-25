import { describe, expect, it } from 'vitest';
import { grantOnSchemas } from '../../../src/operations/grants';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('grants', () => {
    describe('grantOnSchemas', () => {
      const grantOnSchemasFn = grantOnSchemas(options1);

      it('should return a function', () => {
        expect(grantOnSchemasFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = grantOnSchemasFn({
          schemas: 'myschema',
          privileges: 'CREATE',
          roles: 'PUBLIC',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('GRANT CREATE ON SCHEMA "myschema" TO PUBLIC;');
      });

      it('should return sql statement with grantsOptions', () => {
        const statement = grantOnSchemasFn({
          schemas: 'myschema',
          privileges: 'USAGE',
          roles: 'PUBLIC',
          cascade: true,
          withGrantOption: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'GRANT USAGE ON SCHEMA "myschema" TO PUBLIC WITH GRANT OPTION;'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = grantOnSchemasFn({
          schemas: 'myschema',
          privileges: 'USAGE',
          roles: { name: 'PUBLIC', schema: 'myschema' },
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'GRANT USAGE ON SCHEMA "myschema" TO "myschema"."PUBLIC";'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(grantOnSchemasFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = grantOnSchemasFn.reverse({
            schemas: 'myschema',
            privileges: 'CREATE',
            roles: 'PUBLIC',
          });

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'REVOKE CREATE ON SCHEMA "myschema" FROM PUBLIC;'
          );
        });
      });
    });
  });
});
