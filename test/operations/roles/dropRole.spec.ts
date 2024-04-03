import { describe, expect, it } from 'vitest';
import { dropRole } from '../../../src/operations/roles';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('roles', () => {
    describe('dropRole', () => {
      const dropRoleFn = dropRole(options1);

      it('should return a function', () => {
        expect(dropRoleFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropRoleFn('jonathan');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP ROLE "jonathan";');
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropRoleFn('jonathan', {
          ifExists: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP ROLE IF EXISTS "jonathan";');
      });
    });
  });
});
