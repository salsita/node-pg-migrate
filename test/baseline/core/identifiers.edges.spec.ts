import { describe, expect, it } from 'vitest';
import {
  identEquals,
  parseQualifiedName,
} from '../../../src/baseline/core/identifiers';

describe('parseQualifiedName', () => {
  it.each([
    {
      name: 'a dot without an identifier after it, which is not part of the name',
      text: 'public.(',
      expected: { name: 'public', end: 6 },
    },
    {
      name: 'a dot at the end',
      text: 'public.',
      expected: { name: 'public', end: 6 },
    },
    {
      name: 'an empty quoted identifier after a dot, which is not an identifier',
      text: 'public."" x',
      expected: { name: 'public', end: 6 },
    },
    {
      name: 'only the first two parts of a three-part name',
      text: 'db.public.t',
      expected: { schema: 'db', name: 'public', end: 9 },
    },
    {
      name: 'unquoted non-ASCII letters, of which only the ASCII ones fold',
      text: 'Área.Ñame',
      expected: { schema: 'Área', name: 'Ñame', end: 9 },
    },
    {
      name: 'an identifier with dollar signs and digits',
      text: 'app.t$1',
      expected: { schema: 'app', name: 't$1', end: 7 },
    },
    {
      name: 'a quoted identifier that is only a doubled quote',
      text: '""""."x"',
      expected: { schema: '"', name: 'x', end: 8 },
    },
    {
      name: 'the pg_get_serial_sequence of a quoted migrations table',
      text: '"Audit.Trail"."Schema ""Migrations""_id_seq"',
      expected: {
        schema: 'Audit.Trail',
        name: 'Schema "Migrations"_id_seq',
        end: 44,
      },
    },
  ])('parses $name', ({ text, expected }) => {
    expect(parseQualifiedName(text, 0)).toEqual(expected);
  });

  it('does not take an empty quoted identifier for a name', () => {
    expect(parseQualifiedName('"".t', 0)).toBeUndefined();
  });
});

describe('identEquals', () => {
  it.each([
    { parsed: '"a"b', configured: 'a', expected: false },
    { parsed: '"a"b', configured: 'a"b', expected: false },
    { parsed: '"unterminated', configured: 'unterminated', expected: false },
    { parsed: '""', configured: '', expected: false },
    { parsed: 'ÁREA', configured: 'Área', expected: true },
    { parsed: 'ÁREA', configured: 'área', expected: false },
    { parsed: 'Área', configured: 'Área', expected: true },
  ])(
    'compares $parsed with the configured $configured: $expected',
    ({ parsed, configured, expected }) => {
      expect(identEquals(parsed, configured)).toBe(expected);
    }
  );
});
