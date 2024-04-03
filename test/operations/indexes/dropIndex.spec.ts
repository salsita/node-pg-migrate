import { describe, expect, it } from 'vitest';
import { dropIndex } from '../../../src/operations/indexes';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('indexes', () => {
    describe('dropIndex', () => {
      const dropIndexFn = dropIndex(options1);

      it('should return a function', () => {
        expect(dropIndexFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropIndexFn('title_idx', []);

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP INDEX "title_idx__index";');
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropIndexFn('title_idx', [], {
          concurrently: true,
          ifExists: true,
          cascade: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'DROP INDEX CONCURRENTLY IF EXISTS "title_idx__index" CASCADE;'
        );
      });
    });
  });
});
