import { describe, expect, it } from 'vitest';
import { decamelize } from '../../src/utils';

describe('utils', () => {
  describe('decamelize', () => {
    it.each([
      ['', ''],
      ['A', 'a'],
      ['A B', 'a b'],
      ['a2b', 'a2b'],
      ['A2B', 'a2_b'],
      ['_A2B', '_a2_b'],
      ['myURLstring', 'my_ur_lstring'],
      ['unicornsAndRainbows', 'unicorns_and_rainbows'],
      ['UNICORNS AND RAINBOWS', 'unicorns and rainbows'],
      ['unicorns-and-rainbows', 'unicorns-and-rainbows'],
      ['thisIsATest', 'this_is_a_test'],
      ['myURLString', 'my_url_string'],
      ['URLString', 'url_string'],
      ['StringURL', 'string_url'],
      ['testGUILabel', 'test_gui_label'],
      ['CAPLOCKED1', 'caplocked1'],
      ['my_URL_string', 'my_url_string'],
    ])('should handle string %s', (input, expected) => {
      const actual = decamelize(input);

      expect(actual).toBe(expected);
    });
  });
});
