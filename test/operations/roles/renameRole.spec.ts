import { describe, expect, it } from 'vitest';
import { renameRole } from '../../../src/operations/roles';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('roles', () => {
    describe('renameRole', () => {
      const renameRoleFn = renameRole(options1);

      it('should return a function', () => {
        expect(renameRoleFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renameRoleFn('jonathan', 'davide');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('ALTER ROLE "jonathan" RENAME TO "davide";');
      });

      it('should return sql statement with schema', () => {
        const statement = renameRoleFn(
          { name: 'jonathan', schema: 'myschema' },
          { name: 'davide', schema: 'myschema' }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER ROLE "myschema"."jonathan" RENAME TO "myschema"."davide";'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameRoleFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameRoleFn.reverse('jonathan', 'davide');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('ALTER ROLE "davide" RENAME TO "jonathan";');
        });
      });
    });
  });
});
