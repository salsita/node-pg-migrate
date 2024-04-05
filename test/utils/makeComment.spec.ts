import { describe, expect, it } from 'vitest';
import { makeComment } from '../../src/utils';

describe('utils', () => {
  describe('makeComment', () => {
    // TODO @Shinigami92 2024-04-04: Should this throw an error?
    it('should return default comment string', () => {
      const actual = makeComment('', '');

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('COMMENT ON   IS NULL;');
    });

    it('should return comment with default IS NULL', () => {
      const actual = makeComment('COLUMN', '"myTable"."myColumn"');

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('COMMENT ON COLUMN "myTable"."myColumn" IS NULL;');
    });

    it('should return comment with text', () => {
      const actual = makeComment('COLUMN', '"myTable"."myColumn"', 'my text');

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe(
        'COMMENT ON COLUMN "myTable"."myColumn" IS $pga$my text$pga$;'
      );
    });
  });
});
