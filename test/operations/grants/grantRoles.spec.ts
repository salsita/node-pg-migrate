import { describe, expect, it } from 'vitest';
import { grantRoles } from '../../../src/operations/grants';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('grants', () => {
    describe('grantRoles', () => {
      const grantRolesFn = grantRoles(options1);

      it('should return a function', () => {
        expect(grantRolesFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = grantRolesFn('role1', 'role2', {});

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('GRANT "role1" TO "role2";');
      });

      it('should return sql statement with grantsOptions', () => {
        const statement = grantRolesFn('role1', 'role2', {
          withAdminOption: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('GRANT "role1" TO "role2" WITH ADMIN OPTION;');
      });

      it('should return sql statement with schema', () => {
        const statement = grantRolesFn(
          { name: 'role1', schema: 'myschema' },
          { name: 'role2', schema: 'myschema' }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'GRANT "myschema"."role1" TO "myschema"."role2";'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(grantRolesFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = grantRolesFn.reverse('role1', 'role2');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('REVOKE "role1" FROM "role2";');
        });
      });
    });
  });
});
