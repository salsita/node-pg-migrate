import { describe, expect, it } from 'vitest';
import { renameIndex } from '../../../src/operations/indexes';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('indexes', () => {
    describe('renameIndex', () => {
      const renameIndexFn = renameIndex(options1);

      it('should return a function', () => {
        expect(renameIndexFn).toBeTypeOf('function');
      });

      it('should generate correct SQL for renaming an index', () => {
        const statement = renameIndexFn('my_index', 'new_index');
        expect(statement).toBe('ALTER INDEX "my_index" RENAME TO "new_index";');
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameIndexFn.reverse).toBeTypeOf('function');
        });

        it('should generate correct SQL for reversing the rename operation', () => {
          const reverseStatement = renameIndexFn.reverse(
            'my_index',
            'new_index'
          );
          expect(reverseStatement).toBe(
            'ALTER INDEX "new_index" RENAME TO "my_index";'
          );
        });
      });
    });
  });
});
