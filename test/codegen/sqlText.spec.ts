import { describe, expect, it } from 'vitest';
import {
  defaultMultirangeName,
  makeObjectName,
  qualifiedName,
  quoteIdentifier,
  quoteLiteral,
  storageParameters,
  terminated,
} from '../../src/codegen/sql';

describe('quoteIdentifier', () => {
  it.each([
    ['app_user', 'app_user'],
    ['_x1', '_x1'],
    ['App', '"App"'],
    ['1st', '"1st"'],
    ['a$b', '"a$b"'],
    ['ñandú', '"ñandú"'],
    ['user', '"user"'],
    ['select', '"select"'],
    ['left', '"left"'],
    ['integer', '"integer"'],
    ['say "hi"', '"say ""hi"""'],
    ['admin', 'admin'],
  ])('writes %s as %s, like quote_identifier()', (name, expected) => {
    expect(quoteIdentifier(name)).toBe(expected);
  });
});

describe('qualifiedName', () => {
  it('quotes the schema and the name, or the name alone', () => {
    expect(qualifiedName({ schema: 'app', name: 'A "b"' })).toBe(
      '"app"."A ""b"""'
    );
    expect(qualifiedName({ name: 'users' })).toBe('"users"');
  });
});

describe('quoteLiteral', () => {
  it.each([
    ['plain', "'plain'"],
    ["it's", "'it''s'"],
    [String.raw`C:\temp`, String.raw`E'C:\\temp'`],
    [String.raw`it's \n`, String.raw`E'it''s \\n'`],
  ])('writes %s like quote_literal()', (value, expected) => {
    expect(quoteLiteral(value)).toBe(expected);
  });
});

describe('terminated', () => {
  it.each([
    ['SELECT 1', 'SELECT 1;'],
    ['SELECT 1;', 'SELECT 1;'],
    ['CREATE FUNCTION f() … $$\n', 'CREATE FUNCTION f() … $$;'],
    ['SELECT 1; \n', 'SELECT 1;'],
  ])('ends %j with one semicolon', (sql, expected) => {
    expect(terminated(sql)).toBe(expected);
  });
});

describe('makeObjectName', () => {
  it('joins the names and the label when they fit', () => {
    expect(makeObjectName('users', 'id', 'seq')).toBe('users_id_seq');
    expect(makeObjectName('money', undefined, 'not_null')).toBe(
      'money_not_null'
    );
  });

  it('shortens the longer name first, to 63 bytes, like makeObjectName() (checked on PostgreSQL 18)', () => {
    const name = makeObjectName('t'.repeat(60), 'c'.repeat(10), 'seq');

    expect(name).toBe(`${'t'.repeat(48)}_${'c'.repeat(10)}_seq`);
    expect(Buffer.byteLength(name)).toBe(63);
    expect(makeObjectName('a'.repeat(40), 'b'.repeat(40), 'seq')).toBe(
      `${'a'.repeat(29)}_${'b'.repeat(29)}_seq`
    );
    expect(makeObjectName('d'.repeat(70), undefined, 'not_null')).toBe(
      `${'d'.repeat(54)}_not_null`
    );
    expect(makeObjectName('t'.repeat(60), 'c'.repeat(10), 'not_null')).toBe(
      `${'t'.repeat(43)}_${'c'.repeat(10)}_not_null`
    );
  });

  it('counts bytes and never cuts a character in two', () => {
    const name = makeObjectName('é'.repeat(40), 'id', 'seq');

    expect(name).toBe(`${'é'.repeat(28)}_id_seq`);
    expect(Buffer.byteLength(name)).toBe(63);
  });
});

describe('defaultMultirangeName', () => {
  it.each([
    ['float_range', 'float_multirange'],
    ['rangey_range', 'multirangey_range'],
    ['timespan', 'timespan_multirange'],
    ['r'.repeat(60), `${'r'.repeat(52)}_multirange`],
    [`${'x'.repeat(55)}_range`, `${'x'.repeat(55)}_multira`],
  ])('names the multirange of %s %s', (range, expected) => {
    expect(defaultMultirangeName(range)).toBe(expected);
  });
});

describe('storageParameters', () => {
  it('quotes values that are not plain identifiers, like pg_dump', () => {
    expect(
      storageParameters([
        'fillfactor=70',
        'autovacuum_enabled=false',
        'check_option=local',
        'Odd Name=x y',
        'bare',
      ])
    ).toBe(
      `fillfactor='70', autovacuum_enabled='false', check_option=local, "Odd Name"='x y', bare=''`
    );
  });
});
