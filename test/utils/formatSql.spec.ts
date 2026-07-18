import { describe, expect, it } from 'vitest';
import { formatBlock, formatSeparator } from '../../src/utils';

describe('utils', () => {
  describe('formatSeparator', () => {
    it('should use a single whitespace when not pretty', () => {
      expect(formatSeparator(false)).toBe(' ');
    });

    it('should ignore the indent when not pretty', () => {
      expect(formatSeparator(false, '  ')).toBe(' ');
    });

    it('should use a linebreak when pretty', () => {
      expect(formatSeparator(true)).toBe('\n');
    });

    it('should append the indent after the linebreak when pretty', () => {
      expect(formatSeparator(true, '  ')).toBe('\n  ');
    });
  });

  describe('formatBlock', () => {
    it('should return the body unchanged when not pretty', () => {
      expect(formatBlock('"id" serial', false)).toBe('"id" serial');
    });

    it('should surround the body with linebreaks when pretty', () => {
      expect(formatBlock('  "id" serial', true)).toBe('\n  "id" serial\n');
    });
  });
});
