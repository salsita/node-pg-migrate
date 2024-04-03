import { describe, expect, it } from 'vitest';
import type { PgLiteralValue } from '../../src';
import { PgLiteral } from '../../src';
import { escapeValue } from '../../src/utils';

describe('utils', () => {
  describe('escapeValue', () => {
    it("should parse null to 'NULL'", () => {
      const value = null;

      expect(escapeValue(value)).toBe('NULL');
    });

    it('should parse boolean to string', () => {
      const value = true;

      expect(escapeValue(value)).toBe('true');
    });

    it('should escape string', () => {
      const value = '#escape_me';

      expect(escapeValue(value)).toBe('$pga$#escape_me$pga$');
    });

    it('should keep number as is', () => {
      const value = 77.7;

      expect(escapeValue(value)).toBe(77.7);
    });

    it('should parse array to ARRAY constructor syntax string', () => {
      const value = [[1], [2]];
      const value2 = [['a'], ['b']];

      expect(escapeValue(value)).toBe('ARRAY[[1],[2]]');
      expect(escapeValue(value2)).toBe('ARRAY[[$pga$a$pga$],[$pga$b$pga$]]');
    });

    it('should parse PgLiteral to unescaped string', () => {
      const value = PgLiteral.create('@l|<e');

      expect(escapeValue(value)).toBe('@l|<e');
    });

    it('should parse object literal to unescaped string', () => {
      const value: PgLiteralValue = { literal: true, value: '@l|<e' };

      expect(escapeValue(value)).toBe('@l|<e');
    });

    it('should serialize PgLiteral to PgLiteralValue', () => {
      const value = PgLiteral.create('@l|<e');
      const literalValue = JSON.parse(JSON.stringify(value));

      expect(escapeValue(literalValue)).toBe('@l|<e');
    });

    it('should parse unexpected type to empty string', () => {
      const value = undefined;

      expect(
        escapeValue(
          // @ts-expect-error: JS-only test
          value
        )
      ).toBe('');
    });
  });
});
