import { describe, expect, it } from 'vitest';
import {
  identEquals,
  parseQualifiedName,
  toPgDumpPattern,
} from '../../../src/baseline/core/identifiers';

describe('parseQualifiedName', () => {
  it.each([
    {
      name: 'a schema-qualified name',
      text: 'public.pgmigrations',
      from: 0,
      expected: { schema: 'public', name: 'pgmigrations', end: 19 },
    },
    {
      name: 'an unqualified name, up to the first character after it',
      text: 'pgmigrations (id integer)',
      from: 0,
      expected: { name: 'pgmigrations', end: 12 },
    },
    {
      name: 'a name that starts at an offset',
      text: 'CREATE TABLE public.pgmigrations (',
      from: 13,
      expected: { schema: 'public', name: 'pgmigrations', end: 32 },
    },
    {
      name: 'unquoted identifiers, folded to lower case',
      text: 'PUBLIC.PgMigrations;',
      from: 0,
      expected: { schema: 'public', name: 'pgmigrations', end: 19 },
    },
    {
      name: 'quoted identifiers, as they are',
      text: '"Public"."PgMigrations" (',
      from: 0,
      expected: { schema: 'Public', name: 'PgMigrations', end: 23 },
    },
    {
      name: 'an unquoted schema and a quoted name',
      text: 'app."PgMigrations"',
      from: 0,
      expected: { schema: 'app', name: 'PgMigrations', end: 18 },
    },
    {
      name: 'doubled quotes inside quoted identifiers',
      text: '"a ""quoted"" schema"."ta""ble"',
      from: 0,
      expected: { schema: 'a "quoted" schema', name: 'ta"ble', end: 31 },
    },
    {
      name: 'spaces, semicolons and non-ASCII letters inside quoted identifiers',
      text: '"Sink Área"."Order; Lines" (',
      from: 0,
      expected: { schema: 'Sink Área', name: 'Order; Lines', end: 26 },
    },
    {
      name: 'the quoted non-ASCII name of a Pagila domain',
      text: 'CREATE DOMAIN public."bıgınt" AS bigint;',
      from: 14,
      expected: { schema: 'public', name: 'bıgınt', end: 29 },
    },
    {
      name: 'digits and underscores',
      text: 'app_2.order_lines_v2 ',
      from: 0,
      expected: { schema: 'app_2', name: 'order_lines_v2', end: 20 },
    },
    {
      name: 'identifiers that start with an underscore',
      text: '_private._t',
      from: 0,
      expected: { schema: '_private', name: '_t', end: 11 },
    },
    {
      name: 'a name followed by an opening parenthesis',
      text: 'kitchen.orders(id)',
      from: 0,
      expected: { schema: 'kitchen', name: 'orders', end: 14 },
    },
  ])('parses $name', ({ text, from, expected }) => {
    expect(parseQualifiedName(text, from)).toEqual(expected);
  });

  it.each([
    { name: 'empty text', text: '', from: 0 },
    { name: 'a parenthesis', text: '(id integer)', from: 0 },
    { name: 'whitespace', text: ' public.t', from: 0 },
    { name: 'a digit', text: '1abc', from: 0 },
    { name: 'a semicolon', text: ';', from: 0 },
    { name: 'a dot', text: '.name', from: 0 },
    {
      name: 'an unterminated quoted identifier',
      text: '"unterminated',
      from: 0,
    },
    { name: 'the end of the text', text: 'public.t', from: 8 },
    { name: 'an offset past the end', text: 'public.t', from: 99 },
  ])('returns undefined at $name', ({ text, from }) => {
    expect(parseQualifiedName(text, from)).toBeUndefined();
  });
});

describe('identEquals', () => {
  it.each([
    { parsed: 'pgmigrations', configured: 'pgmigrations', expected: true },
    { parsed: 'PgMigrations', configured: 'pgmigrations', expected: true },
    { parsed: 'PGMIGRATIONS', configured: 'pgmigrations', expected: true },
    { parsed: '"pgmigrations"', configured: 'pgmigrations', expected: true },
    { parsed: '"PgMigrations"', configured: 'PgMigrations', expected: true },
    { parsed: '"PgMigrations"', configured: 'pgmigrations', expected: false },
    { parsed: 'PgMigrations', configured: 'PgMigrations', expected: false },
    { parsed: '"a""b"', configured: 'a"b', expected: true },
    { parsed: '"bıgınt"', configured: 'bıgınt', expected: true },
    { parsed: '"Sink Área"', configured: 'Sink Área', expected: true },
    { parsed: 'pgmigrations2', configured: 'pgmigrations', expected: false },
    { parsed: 'pgmigration', configured: 'pgmigrations', expected: false },
  ])(
    'compares $parsed with the configured $configured: $expected',
    ({ parsed, configured, expected }) => {
      expect(identEquals(parsed, configured)).toBe(expected);
    }
  );
});

describe('toPgDumpPattern', () => {
  it.each([
    {
      name: { schema: 'public', name: 'pgmigrations' },
      expected: '"public"."pgmigrations"',
    },
    {
      name: { schema: 'App', name: 'PgMigrations' },
      expected: '"App"."PgMigrations"',
    },
    {
      name: { schema: 'we"ird', name: 'ta""ble' },
      expected: '"we""ird"."ta""""ble"',
    },
    {
      name: { schema: 'Sink Área', name: 'Order; Lines' },
      expected: '"Sink Área"."Order; Lines"',
    },
    {
      name: { schema: 'a.b', name: 'c*d?' },
      expected: '"a.b"."c*d?"',
    },
    {
      name: { name: 'app' },
      expected: '"app"',
    },
  ])('quotes $name as $expected', ({ name, expected }) => {
    expect(toPgDumpPattern(name)).toBe(expected);
  });

  it.each([
    { schema: 'public', name: 'pgmigrations' },
    { schema: 'App', name: 'PgMigrations_id_seq' },
    { schema: 'we"ird', name: 'ta""ble' },
    { schema: 'Sink Área', name: 'Order; Lines' },
    { schema: 'public', name: 'bıgınt' },
  ])('makes a pattern that parses back to $schema / $name', (name) => {
    const pattern = toPgDumpPattern(name);

    expect(parseQualifiedName(pattern, 0)).toEqual({
      ...name,
      end: pattern.length,
    });
  });
});
