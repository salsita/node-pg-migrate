import { describe, expect, it } from 'vitest';
import { revokeOnSchemas } from '../../../src/operations/grants';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('grants', () => {
    describe('revokeOnSchemas', () => {
      const revokeOnSchemasFn = revokeOnSchemas(options1);

      it('should return a function', () => {
        expect(revokeOnSchemasFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = revokeOnSchemasFn({
          schemas: 'myschema',
          privileges: 'CREATE',
          roles: 'PUBLIC',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'REVOKE CREATE ON SCHEMA "myschema" FROM PUBLIC;'
        );
      });

      it('should return sql statement with dropOptions', () => {
        const statement = revokeOnSchemasFn({
          schemas: 'myschema',
          privileges: 'USAGE',
          roles: 'PUBLIC',
          cascade: true,
          onlyGrantOption: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'REVOKE GRANT OPTION FOR USAGE ON SCHEMA "myschema" FROM PUBLIC CASCADE;'
        );
      });
    });
  });
});
