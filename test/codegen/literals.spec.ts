import { runInThisContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { tsString } from '../../src/codegen/literals';

function evaluate(literal: string): unknown {
  return runInThisContext(`(${literal})`);
}

describe('tsString', () => {
  it('writes a single-quoted literal and escapes single quotes', () => {
    expect(tsString("it's")).toBe(String.raw`'it\'s'`);
  });

  it.each([
    ['an empty string', ''],
    ['plain text', 'plain text'],
    ['single quotes', "it's 'quoted'"],
    ['double quotes and backticks', '"double" and `backtick`'],
    ['backslashes', String.raw`C:\temp\new \n is not a newline \u0041`],
    ['a newline', 'first line\nsecond line'],
    ['a carriage return', 'windows\r\nline'],
    ['tabs and other control characters', 'a\tb\0c\u0001d\u001Fe\u007Ff\bg'],
    ['a template placeholder', '${not} interpolated, nor `${this}`'],
    ['non-ASCII text', 'bıgınt, ñandú, 漢字, 😀'],
    ['the line separators of JavaScript', 'one\u2028two\u2029three'],
    ['SQL punctuation', 'semi; colon -- dash /* star */ $$ dollar {name}'],
    ['a closing script tag', '</script>'],
  ])(
    'writes %s so that it evaluates to the same string, on one line',
    (_, value) => {
      const literal = tsString(value);

      expect(evaluate(literal)).toBe(value);
      expect(literal.startsWith("'") && literal.endsWith("'")).toBe(true);
      expect(literal).not.toMatch(/[\n\r\u2028\u2029]/);
      expect(
        Array.from(
          { length: literal.length },
          (_unused, index) => literal.codePointAt(index) ?? 0
        ).filter((code) => code < 0x20)
      ).toStrictEqual([]);
      expect(tsString(value)).toBe(literal);
    }
  );

  it('writes a long SQL statement that evaluates to the same string', () => {
    const sql = `CREATE FUNCTION f() RETURNS text AS $body$\n${"SELECT 'x';\n".repeat(1000)}$body$ LANGUAGE sql`;

    expect(evaluate(tsString(sql))).toBe(sql);
  });
});
