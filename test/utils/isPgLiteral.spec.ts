import { describe, expect, it } from 'vitest';
import { PgLiteral } from '../../src';
import { isPgLiteral } from '../../src/utils';

describe('utils', () => {
  describe('isPgLiteral', () => {
    it('should return true on PgLiteralLike', () => {
      const actual = isPgLiteral({ literal: true });

      expect(actual).toBeTypeOf('boolean');
      expect(actual).toBe(true);
    });

    it('should return true on PgLiteral', () => {
      const actual = isPgLiteral(PgLiteral.create('SELECT 1'));

      expect(actual).toBeTypeOf('boolean');
      expect(actual).toBe(true);
    });

    it.each([null, undefined, 1, 'a', true])(
      'should return false on invalid value %o',
      (val) => {
        const actual = isPgLiteral(val);

        expect(actual).toBeTypeOf('boolean');
        expect(actual).toBe(false);
      }
    );
  });
});
