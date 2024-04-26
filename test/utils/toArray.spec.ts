import { describe, expect, it } from 'vitest';
import { toArray } from '../../src/utils';

describe('utils', () => {
  describe('toArray', () => {
    it('should return wrap a single item in an array', () => {
      const actual = toArray('test');

      expect(actual).toBeInstanceOf(Array);
      expect(actual).toHaveLength(1);
      expect(actual).toStrictEqual(['test']);
    });

    it('should return a copy of an array', () => {
      const input = ['test'];
      const actual = toArray(input);

      expect(actual).toBeInstanceOf(Array);
      expect(actual).toHaveLength(1);
      expect(actual).toStrictEqual(['test']);
      expect(actual).not.toBe(input);
    });
  });
});
