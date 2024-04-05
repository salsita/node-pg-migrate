import { describe, expect, it } from 'vitest';
import { dropView } from '../../../src/operations/views';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('views', () => {
    describe('dropView', () => {
      const dropViewFn = dropView(options1);

      it('should return a function', () => {
        expect(dropViewFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropViewFn('kinds');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP VIEW "kinds";');
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropViewFn('kinds', {
          ifExists: true,
          cascade: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP VIEW IF EXISTS "kinds" CASCADE;');
      });
    });
  });
});
