import { describe, expect, it } from 'vitest';
import { localeCompareStringsNumerically } from '../../src/utils';

describe('localeCompareStringsNumerically', () => {
  it('sorts 062_view before 062_view_test', () => {
    const files = ['062_view_test.js', '062_view.js'];

    const sorted = files.toSorted(localeCompareStringsNumerically);

    expect(sorted).toEqual(['062_view.js', '062_view_test.js']);
  });
});
