import { describe, expect, it } from 'vitest';
import { alterRole } from '../../../src/operations/roles';
import { options1 } from '../../utils';

describe('operations', () => {
  describe('roles', () => {
    describe('alterRole', () => {
      const alterRoleFn = alterRole(options1);

      it('should return a function', () => {
        expect(alterRoleFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = alterRoleFn('jonathan', {});

        expect(statement).toBeTypeOf('string');
        expect(statement).toHaveLength(0);
      });

      it('should return sql statement with roleOptions', () => {
        const statement = alterRoleFn('jonathan', {
          replication: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toStrictEqual(
          'ALTER ROLE "jonathan" WITH REPLICATION;'
        );
      });
    });
  });
});
