import { describe, expect, it } from 'vitest';
import { createRenameOperation } from '../../src/operations/createRenameOperation';
import { options1 } from '../presetMigrationOptions';

describe('operations', () => {
  describe('createRenameOperation', () => {
    it.each([
      ['TABLE', undefined, ''],
      ['FUNCTION', '()', '()'],
      ['FUNCTION', '(integer, text)', '(integer, text)'],
      ['OPERATOR CLASS', ' USING btree', ' USING btree'],
      ['OPERATOR FAMILY', ' USING hash', ' USING hash'],
    ])(
      'preserves the source identity for %s with suffix %j',
      (keyword, suffix, expectedSuffix) => {
        const rename = createRenameOperation(options1, {
          operation: 'rename',
          keyword,
          label: 'an object',
        });
        const source = { schema: 'app', name: 'old' };
        const destination = { schema: 'app', name: 'new' };

        expect(rename(source, destination, suffix)).toBe(
          `ALTER ${keyword} "app"."old"${expectedSuffix} RENAME TO "new";`
        );
        expect(rename.reverse(source, destination, suffix)).toBe(
          `ALTER ${keyword} "app"."new"${expectedSuffix} RENAME TO "old";`
        );
      }
    );
  });
});
