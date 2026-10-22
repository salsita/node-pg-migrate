import { describe, expect, it } from 'vitest';
import type { PgLiteralValue } from '../../src';
import { escapeValue, PgLiteral } from '../../src';

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

    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
      'preserves non-finite numbers outside option formatting: %s',
      (value) => {
        expect(escapeValue(value)).toBe(value);
        expect(escapeValue([[value]])).toBe(`ARRAY[[${value}]]`);
        expect(escapeValue(PgLiteral.create(String(value)))).toBe(
          String(value)
        );
      }
    );

    it.each([
      ["user's table", "$pga$user's table$pga$"],
      [String.raw`user\'s table`, String.raw`$pga$user\'s table$pga$`],
      ['tag$pga$', '$pgb$tag$pga$$pgb$'],
      ['tag$pga', '$pgb$tag$pga$pgb$'],
      ['tag$pga$pgb', '$pgc$tag$pga$pgb$pgc$'],
      ['tag$pga$pgb$', '$pgc$tag$pga$pgb$$pgc$'],
    ])('should preserve the string %s inside its delimiter', (value, sql) => {
      expect(escapeValue(value)).toBe(sql);
    });

    it('should avoid delimiter overlaps in nested array strings', () => {
      expect(escapeValue([['tag$pga'], ['tag$pga$pgb']])).toBe(
        'ARRAY[[$pgb$tag$pga$pgb$],[$pgc$tag$pga$pgb$pgc$]]'
      );
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

    it('should parse deeply nested array to ARRAY constructor syntax string', () => {
      const value = [
        [[1], [2]],
        [[3], [4]],
      ];

      const actual = escapeValue(value);

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('ARRAY[[[1],[2]],[[3],[4]]]');
    });

    it('should keep the ARRAY substring inside escaped strings', () => {
      const value = ['ARRAY_A', 'ARRAY_B'];

      const actual = escapeValue(value);

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('ARRAY[$pga$ARRAY_A$pga$,$pga$ARRAY_B$pga$]');
    });

    it('should keep the ARRAY substring inside nested escaped strings', () => {
      const value = [['an ARRAY of things']];

      const actual = escapeValue(value);

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('ARRAY[[$pga$an ARRAY of things$pga$]]');
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

    it.each([
      [{}, '$pga${}$pga$'],
      [{ attempts: 0, uploads: 0 }, '$pga${"attempts":0,"uploads":0}$pga$'],
      [
        { nested: { enabled: false, items: [1, 'two', null] } },
        '$pga${"nested":{"enabled":false,"items":[1,"two",null]}}$pga$',
      ],
      [
        { text: "user's $pga$ value", name: '名' },
        '$pgb${"text":"user\'s $pga$ value","name":"名"}$pgb$',
      ],
      [
        { nested: { literal: true, value: 'now()' } },
        '$pga${"nested":{"literal":true,"value":"now()"}}$pga$',
      ],
    ])('should escape JSON object %j as a string', (value, expected) => {
      expect(escapeValue(value)).toBe(expected);
    });

    it('should serialize an object with a null prototype', () => {
      const value = Object.assign(Object.create(null), { attempts: 0 });

      expect(escapeValue(value)).toBe('$pga${"attempts":0}$pga$');
    });

    it('should propagate JSON serialization errors', () => {
      const value: Record<string, unknown> = {};
      value.self = value;

      expect(() => escapeValue(value)).toThrow(TypeError);
    });

    it('should serialize nested dates through their toJSON method', () => {
      expect(escapeValue({ createdAt: new Date(0) })).toBe(
        '$pga${"createdAt":"1970-01-01T00:00:00.000Z"}$pga$'
      );
    });

    it.each([
      new Date(0),
      new Map(),
      new Set(),
      () => {},
      { toJSON: () => {} },
    ])(
      'should reject unsupported values instead of producing empty SQL: %s',
      (value) => {
        expect(() => escapeValue(value)).toThrow(
          new TypeError(
            'Unsupported value: expected a plain object, array, string, number, boolean, null or SQL literal'
          )
        );
      }
    );

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
