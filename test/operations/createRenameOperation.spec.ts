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
          sourceSuffix: suffix,
        });
        const source = { schema: 'app', name: 'old' };
        const destination = { schema: 'app', name: 'new' };

        expect(rename(source, destination)).toBe(
          `ALTER ${keyword} "app"."old"${expectedSuffix} RENAME TO "new";`
        );
        expect(rename.reverse(source, destination)).toBe(
          `ALTER ${keyword} "app"."new"${expectedSuffix} RENAME TO "old";`
        );
      }
    );

    it('keeps each identity independent of other pairs and extra arguments', () => {
      const options = {
        operation: 'renameFunction',
        keyword: 'FUNCTION',
        label: 'a function',
      };
      const first = createRenameOperation(options1, {
        ...options,
        sourceSuffix: '(integer)',
      });
      const second = createRenameOperation(options1, {
        ...options,
        sourceSuffix: '()',
      });
      const plain = createRenameOperation(options1, {
        ...options,
        keyword: 'TABLE',
      });

      expect(Reflect.apply(first, undefined, ['a', 'b', '(text)'])).toBe(
        'ALTER FUNCTION "a"(integer) RENAME TO "b";'
      );
      expect(second('a', 'b')).toBe('ALTER FUNCTION "a"() RENAME TO "b";');
      expect(
        Reflect.apply(first.reverse, undefined, ['a', 'b', '(text)'])
      ).toBe('ALTER FUNCTION "b"(integer) RENAME TO "a";');
      expect(plain('a', 'b')).toBe('ALTER TABLE "a" RENAME TO "b";');
    });
  });
});
