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
        expect(statement).toBe(
          'CREATE INDEX "title_idx" ON "films" ("title");'
        );
      });

      it('should return sql statement with grantsOptions', () => {
        const statement = grantRolesFn('role1', 'role2', {
          withAdminOption: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "films_title_unique_index" ON "films" ("title") INCLUDE ("director", "rating");'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = grantRolesFn(
          { name: 'role1', schema: 'myschema' },
          { name: 'role2', schema: 'myschema' }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE INDEX "films_title_index" ON "myschema"."films" ("title" ASC);'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(grantRolesFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = grantRolesFn.reverse('role1', 'role2');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('DROP INDEX "films_title_index";');
        });
      });
    });
  });
});
