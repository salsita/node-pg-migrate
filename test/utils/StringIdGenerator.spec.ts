import { describe, expect, it } from 'vitest';
import { StringIdGenerator } from '../../src/utils';

describe('utils', () => {
  describe('StringIdGenerator', () => {
    it('should generate correct sequence with default chars', () => {
      const ids = new StringIdGenerator();
      // eslint-disable-next-line @typescript-eslint/no-misused-spread
      const results = [...'abcdefghijklmnopqrstuvwxyz', 'aa', 'ab'];

      for (const res of results) {
        expect(ids.next()).toBe(res);
      }
    });

    it('should generate correct sequence with custom chars', () => {
      const chars = 'abcd';

      const ids = new StringIdGenerator(chars);
      const results = [
        'a',
        'b',
        'c',
        'd',
        'aa',
        'ab',
        'ac',
        'ad',
        'ba',
        'bb',
        'bc',
        'bd',
        'ca',
        'cb',
        'cc',
        'cd',
        'da',
        'db',
        'dc',
        'dd',
        'aaa',
        'aab',
        'aac',
        'aad',
      ];

      for (const res of results) {
        expect(ids.next()).toBe(res);
      }
    });
  });
});
