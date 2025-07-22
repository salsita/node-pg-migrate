import { describe, expect, it } from 'vitest';
import { stringIdGenerator } from '../../src/utils';

describe('utils', () => {
  describe('stringIdGenerator', () => {
    it('should generate correct sequence with default chars', () => {
      const ids = stringIdGenerator();
      // eslint-disable-next-line @typescript-eslint/no-misused-spread
      const results = [...'abcdefghijklmnopqrstuvwxyz', 'aa', 'ab'];

      for (const res of results) {
        expect(ids.next().value).toBe(res);
      }
    });

    it('should generate repeated single char', () => {
      const ids = stringIdGenerator('x');
      expect(ids.next().value).toBe('x');
      expect(ids.next().value).toBe('xx');
      expect(ids.next().value).toBe('xxx');
    });

    it('should transition from z to aa with default chars', () => {
      const ids = stringIdGenerator();
      let last!: string;
      for (let i = 0; i < 27; i++) {
        last = ids.next().value;
      }

      expect(last).toBe('aa');
    });

    it('should transition from Z to AA with uppercase chars', () => {
      const ids = stringIdGenerator('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      let last!: string;
      for (let i = 0; i < 27; i++) {
        last = ids.next().value;
      }

      expect(last).toBe('AA');
    });

    it('should throw if chars is empty', () => {
      const gen = stringIdGenerator('');
      expect(() => gen.next()).toThrow('chars must be a non-empty string');
    });

    it('should generate correct sequence with custom chars', () => {
      const chars = 'abcd';

      const ids = stringIdGenerator(chars);
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
        expect(ids.next().value).toBe(res);
      }
    });
  });
});
