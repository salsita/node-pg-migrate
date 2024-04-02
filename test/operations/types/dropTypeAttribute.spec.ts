import { describe, expect, it } from 'vitest';
import { dropTypeAttribute } from '../../../src/operations/types';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('types', () => {
    describe('dropTypeAttribute', () => {
      const dropTypeAttributeFn = dropTypeAttribute(options1);

      it('should return a function', () => {
        expect(dropTypeAttributeFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropTypeAttributeFn('compfoo', 'bar', {});

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('ALTER TYPE "compfoo" DROP ATTRIBUTE "bar";');
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropTypeAttributeFn('compfoo', 'bar', {
          ifExists: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TYPE "compfoo" DROP ATTRIBUTE "bar" IF EXISTS;'
        );
      });
    });
  });
});
