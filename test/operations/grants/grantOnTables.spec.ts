import { describe, expect, it } from 'vitest';
import { grantOnTables } from '../../../src/operations/grants';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('grants', () => {
    describe('grantOnTables', () => {
      const grantOnTablesFn = grantOnTables(options1);

      it('should return a function', () => {
        expect(grantOnTablesFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = grantOnTablesFn({
          tables: 'films',
          privileges: 'INSERT',
          roles: 'PUBLIC',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('GRANT INSERT ON "films" TO PUBLIC;');
      });

      it('should return sql statement with grantsOptions', () => {
        const statement = grantOnTablesFn({
          tables: 'films',
          privileges: ['DELETE', 'UPDATE'],
          roles: 'PUBLIC',
          cascade: true,
          withGrantOption: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'GRANT DELETE, UPDATE ON "films" TO PUBLIC WITH GRANT OPTION;'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = grantOnTablesFn({
          tables: { name: 'films', schema: 'myschema' },
          privileges: 'INSERT',
          roles: { name: 'PUBLIC', schema: 'myschema' },
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'GRANT INSERT ON "myschema"."films" TO "myschema"."PUBLIC";'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(grantOnTablesFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = grantOnTablesFn.reverse({
            tables: 'films',
            privileges: 'INSERT',
            roles: 'PUBLIC',
          });

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('REVOKE INSERT ON "films" FROM PUBLIC;');
        });
      });
    });
  });
});
