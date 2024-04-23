import { describe, expect, it } from 'vitest';
import { revokeOnTables } from '../../../src/operations/grants';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('grants', () => {
    describe('revokeOnTables', () => {
      const revokeOnTablesFn = revokeOnTables(options1);

      it('should return a function', () => {
        expect(revokeOnTablesFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = revokeOnTablesFn({
          tables: 'films',
          privileges: 'INSERT',
          roles: 'PUBLIC',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('REVOKE INSERT ON "films" FROM PUBLIC;');
      });

      it('should return sql statement with dropOptions', () => {
        const statement = revokeOnTablesFn({
          tables: 'films',
          privileges: ['DELETE', 'UPDATE'],
          roles: 'PUBLIC',
          cascade: true,
          onlyGrantOption: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'REVOKE GRANT OPTION FOR DELETE, UPDATE ON "films" FROM PUBLIC CASCADE;'
        );
      });
    });
  });
});
