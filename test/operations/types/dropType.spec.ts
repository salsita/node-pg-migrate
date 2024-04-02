import { describe, expect, it } from 'vitest';
import { dropType } from '../../../src/operations/types';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('types', () => {
    describe('dropType', () => {
      const dropTypeFn = dropType(options1);

      it('should return a function', () => {
        expect(dropTypeFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropTypeFn('box');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP TYPE "box";');
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropTypeFn('box', {
          ifExists: true,
          cascade: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP TYPE IF EXISTS "box" CASCADE;');
      });
    });
  });
});
