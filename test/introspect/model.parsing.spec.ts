import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { compareText, oidKey, sortByKey } from '../../src/introspect/core/sort';
import {
  splitSetting,
  triggerArguments,
  triggerCondition,
  withoutFinalSemicolon,
} from '../../src/introspect/core/text';

describe('splitSetting', () => {
  it.each([
    ['search_path=pg_catalog, pg_temp', 'search_path', 'pg_catalog, pg_temp'],
    ['kitchen.note=a=b', 'kitchen.note', 'a=b'],
    ['search_path=""', 'search_path', '""'],
    ['work_mem=', 'work_mem', ''],
    ['no_value', 'no_value', ''],
  ])('splits %s at its first =', (entry, name, value) => {
    expect(splitSetting(entry)).toStrictEqual({ name, value });
  });
});

describe('withoutFinalSemicolon', () => {
  it.each([
    [' SELECT 1;', ' SELECT 1'],
    [" SELECT 'a;b'::text;", " SELECT 'a;b'::text"],
    [' SELECT 1', ' SELECT 1'],
    [' SELECT 1;;', ' SELECT 1;'],
    ['', ''],
  ])('turns %j into %j', (text, expected) => {
    expect(withoutFinalSemicolon(text)).toBe(expected);
  });
});

describe('triggerArguments', () => {
  it('decodes zero-terminated UTF-8 arguments, empty ones included', () => {
    expect(
      triggerArguments(Buffer.from("a'b\0café\0\0x y\0", 'utf8'))
    ).toStrictEqual(["a'b", 'café', '', 'x y']);
  });

  it('gives no arguments for empty bytes', () => {
    expect(triggerArguments(new Uint8Array())).toStrictEqual([]);
  });

  it('ignores bytes after the last zero byte', () => {
    expect(triggerArguments(Buffer.from('one\0two', 'utf8'))).toStrictEqual([
      'one',
    ]);
  });
});

describe('triggerCondition', () => {
  it('gives no condition to a trigger without WHEN', () => {
    expect(
      triggerCondition(
        'CREATE TRIGGER t BEFORE INSERT ON s.t FOR EACH ROW EXECUTE FUNCTION s.f()'
      )
    ).toBeUndefined();
  });

  it('takes the condition up to its closing parenthesis', () => {
    expect(
      triggerCondition(
        'CREATE TRIGGER t BEFORE UPDATE ON s.t FOR EACH ROW WHEN ((old.a IS DISTINCT FROM new.a)) EXECUTE FUNCTION s.f()'
      )
    ).toBe('(old.a IS DISTINCT FROM new.a)');
  });

  it('skips parentheses and quotes inside string literals and quoted identifiers', () => {
    expect(
      triggerCondition(
        `CREATE TRIGGER t BEFORE UPDATE ON s.t FOR EACH ROW WHEN (((old."a)(" <> ')(''x'::text) AND (new."b""(" = 'y'))) EXECUTE FUNCTION s.f(')')`
      )
    ).toBe(`((old."a)(" <> ')(''x'::text) AND (new."b""(" = 'y'))`);
  });

  it('does not take WHEN ( inside a quoted name for the condition', () => {
    expect(
      triggerCondition(
        'CREATE TRIGGER "x WHEN (y" BEFORE UPDATE OF "c WHEN (d" ON s."t WHEN (" FOR EACH ROW WHEN ((new.c > 0)) EXECUTE FUNCTION s.f()'
      )
    ).toBe('(new.c > 0)');
  });

  it('gives no condition when the definition ends before the condition does', () => {
    expect(
      triggerCondition('CREATE TRIGGER t BEFORE UPDATE ON s.t WHEN ((a > 0)')
    ).toBeUndefined();
    expect(
      triggerCondition("CREATE TRIGGER t BEFORE UPDATE ON s.t WHEN (a = ')")
    ).toBeUndefined();
    expect(
      triggerCondition('CREATE TRIGGER "t WHEN (a) BEFORE UPDATE ON s.t')
    ).toBeUndefined();
  });
});

describe('sorting', () => {
  it('compares strings by UTF-16 code units', () => {
    expect(compareText('B', 'a')).toBeLessThan(0);
    expect(compareText('a', 'B')).toBeGreaterThan(0);
    expect(compareText('é', 'é')).toBe(0);
  });

  it('writes OIDs so that they sort as numbers', () => {
    expect(oidKey(999) < oidKey(1000)).toBe(true);
    expect(oidKey(4_294_967_295)).toBe('4294967295');
  });

  it('sorts by each part of the key in turn and keeps the order of equal keys', () => {
    const items = [
      { id: 1, key: ['b', 'x'] },
      { id: 2, key: ['a', 'z'] },
      { id: 3, key: ['b', 'x'] },
      { id: 4, key: ['a', 'y'] },
    ];

    expect(
      sortByKey(items, ({ key }) => key).map(({ id }) => id)
    ).toStrictEqual([4, 2, 1, 3]);
  });
});
