import { describe, expect, it } from 'vitest';
import type { PgLiteralValue } from '../../src';
import { PgLiteral } from '../../src';
import { escapeValue } from '../../src/utils';

describe('utils', () => {
  describe('escapeValue', () => {
    it("should parse null to 'NULL'", () => {
      const value = null;

      const actual = escapeValue(value);

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('NULL');
    });

    it('should parse boolean to string', () => {
      const value = true;

      const actual = escapeValue(value);

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('true');
    });

    it('should escape string', () => {
      const value = '#escape_me';

      const actual = escapeValue(value);

      expect(actual).toBeTypeOf('string');
      expect(actual).toMatch(/^\$pga\$.*\$pga\$$/);
      expect(actual).toBe('$pga$#escape_me$pga$');
    });

    it('should keep number as is', () => {
      const value = 77.7;

      const actual = escapeValue(value);

      expect(actual).toBeTypeOf('number');
      expect(actual).toBe(77.7);
    });

    it('should parse array to ARRAY constructor syntax string', () => {
      const value = [[1], [2]];

      const actual = escapeValue(value);

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('ARRAY[[1],[2]]');
    });

    it('should parse array to ARRAY constructor syntax escape string', () => {
      const value = [['a'], ['b']];

      const actual = escapeValue(value);

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('ARRAY[[$pga$a$pga$],[$pga$b$pga$]]');
    });

    it('should parse PgLiteral to unescaped string', () => {
      const input = '@l|<e';
      const value = PgLiteral.create(input);

      const actual = escapeValue(value);

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe(input);
    });

    it('should parse object literal to unescaped string', () => {
      const input = '@l|<e';
      const value: PgLiteralValue = { literal: true, value: input };

      const actual = escapeValue(value);

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe(input);
    });

    it('should serialize PgLiteral to PgLiteralValue', () => {
      const input = '@l|<e';
      const value = PgLiteral.create(input);
      const literalValue = JSON.parse(JSON.stringify(value));

      const actual = escapeValue(literalValue);

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe(input);
    });

    // TODO @Shinigami92 2024-04-03: Should this throw an error?
    it('should parse unexpected type to empty string', () => {
      const value = undefined;

      const actual = escapeValue(
        // @ts-expect-error: JS-only test
        value
      );

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('');
    });
  });
});
