import { describe, expect, it } from 'vitest';
import {
  assertPgDumpCompatible,
  parsePgDumpVersion,
  serverMajor,
} from '../../../src/baseline/core/version';
import { BaselineError } from '../../../src/baseline/errors';
import { messageOf, thrownBy } from '../helpers';

describe('parsePgDumpVersion', () => {
  it.each([
    {
      text: 'pg_dump (PostgreSQL) 18.6',
      expected: { major: 18, minor: 6, raw: '18.6' },
    },
    {
      text: 'pg_dump (PostgreSQL) 18.6\n',
      expected: { major: 18, minor: 6, raw: '18.6' },
    },
    {
      text: 'pg_dump (PostgreSQL) 14.24\n',
      expected: { major: 14, minor: 24, raw: '14.24' },
    },
    {
      text: 'pg_dump (PostgreSQL) 16.11 (Homebrew)\n',
      expected: { major: 16, minor: 11, raw: '16.11 (Homebrew)' },
    },
    {
      text: 'pg_dump (PostgreSQL) 17.2 (Debian 17.2-1.pgdg120+1)\n',
      expected: { major: 17, minor: 2, raw: '17.2 (Debian 17.2-1.pgdg120+1)' },
    },
  ])('parses $text', ({ text, expected }) => {
    expect(parsePgDumpVersion(text)).toEqual(expected);
  });

  it('parses a pre-release without a minor version', () => {
    const version = parsePgDumpVersion('pg_dump (PostgreSQL) 18beta1\n');

    expect(version).toEqual({ major: 18, raw: '18beta1' });
    expect(version.minor).toBeUndefined();
  });

  it.each([
    '',
    'pg_dump: command not found',
    'pg_dump (PostgreSQL)',
    'pg_dump (PostgreSQL) abc',
    'psql (PostgreSQL) 18.6',
    'Usage: pg_dump [OPTION]... [DBNAME]',
  ])('refuses %j', (text) => {
    const error = thrownBy(() => parsePgDumpVersion(text));

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'PG_DUMP_FAILED' });
  });
});

describe('serverMajor', () => {
  it.each([
    { num: 140024, major: 14 },
    { num: 150019, major: 15 },
    { num: 160015, major: 16 },
    { num: 170011, major: 17 },
    { num: 180006, major: 18 },
    { num: 180000, major: 18 },
    { num: 100000, major: 10 },
  ])('gives $major for server_version_num $num', ({ num, major }) => {
    expect(serverMajor(num)).toBe(major);
  });
});

describe('assertPgDumpCompatible', () => {
  it.each([
    {
      name: 'the same major and minor version',
      pgDump: { major: 18, minor: 6, raw: '18.6' },
      num: 180006,
      server: '18.6',
    },
    {
      name: 'an older minor version of the same major',
      pgDump: { major: 18, minor: 0, raw: '18.0' },
      num: 180006,
      server: '18.6',
    },
    {
      name: 'a newer major version',
      pgDump: { major: 18, minor: 6, raw: '18.6' },
      num: 140024,
      server: '14.24',
    },
    {
      name: 'a pre-release of the same major',
      pgDump: { major: 18, raw: '18beta1' },
      num: 180000,
      server: '18beta1',
    },
  ])('accepts pg_dump with $name', ({ pgDump, num, server }) => {
    expect(() => {
      assertPgDumpCompatible(pgDump, num, server);
    }).not.toThrow();
  });

  it('refuses a pg_dump older than the server, naming both versions', () => {
    const error = thrownBy(() => {
      assertPgDumpCompatible(
        { major: 17, minor: 2, raw: '17.2 (Debian 17.2-1.pgdg120+1)' },
        180006,
        '18.6'
      );
    });

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'PG_DUMP_TOO_OLD' });
    expect(messageOf(error)).toContain('17.2');
    expect(messageOf(error)).toContain('18.6');
  });
});
