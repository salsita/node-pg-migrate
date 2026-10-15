import { describe, expect, it } from 'vitest';
import { formatOption, quote, quoteOptionName } from '../../src/utils';

describe('utils', () => {
  describe('quoteOptionName', () => {
    it.each([
      ['FillFactor', '"fillfactor"'],
      ['TOAST.Autovacuum_enabled', '"toast"."autovacuum_enabled"'],
      ['ÄA.ÖB', '"Äa"."Öb"'],
      ['A.B.C', '"a"."b"."c"'],
      ['custom"Option', '"custom""option"'],
    ])('quotes %s with ASCII case folding and namespaces', (name, expected) => {
      expect(quoteOptionName(name)).toBe(expected);
    });
  });

  describe('formatOption', () => {
    it('preserves the supplied quoting and case of index option names', () => {
      expect(formatOption(quote('FillFactor'), 70)).toBe('"FillFactor" = 70');
    });

    it('preserves quoted namespaces for materialized-view parameters', () => {
      expect(
        formatOption(quoteOptionName('TOAST.Autovacuum_enabled'), false)
      ).toBe('"toast"."autovacuum_enabled" = false');
    });

    it('escapes string values with colliding dollar-quote delimiters', () => {
      expect(
        formatOption(quoteOptionName('custom"Option'), "a'b$pga$); --")
      ).toBe('"custom""option" = $pgb$a\'b$pga$); --$pgb$');
    });

    it.each([
      { value: true, expected: 'true' },
      { value: false, expected: 'false' },
      { value: 0, expected: '0' },
      { value: null, expected: 'NULL' },
    ])('renders $value as $expected', ({ value, expected }) => {
      expect(formatOption('"option"', value)).toBe(`"option" = ${expected}`);
    });
  });
});
