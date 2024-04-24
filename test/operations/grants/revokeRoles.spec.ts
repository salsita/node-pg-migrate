import { describe, expect, it } from 'vitest';
import { revokeRoles } from '../../../src/operations/grants';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('grants', () => {
    describe('revokeRoles', () => {
      const revokeRolesFn = revokeRoles(options1);

      it('should return a function', () => {
        expect(revokeRolesFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = revokeRolesFn('role1', 'role2');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('REVOKE "role1" FROM "role2";');
      });

      it('should return sql statement with dropOptions', () => {
        const statement = revokeRolesFn('role1', 'role2', {
          cascade: true,
          onlyAdminOption: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'REVOKE ADMIN OPTION FOR "role1" FROM "role2" CASCADE;'
        );
      });
    });
  });
});
