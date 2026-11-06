import { describe, expect, it } from 'vitest';
import {
  assertPgDumpCompatible,
  parsePgDumpVersion,
} from '../../../src/baseline/core/version';
import { messageOf, thrownBy } from '../helpers';

describe('parsePgDumpVersion', () => {
  it.each([
    {
      text: 'pg_dump (PostgreSQL) 18.6\nsomething else\n',
      expected: { major: 18, minor: 6, raw: '18.6' },
    },
    {
      text: '  pg_dump (PostgreSQL) 17.2  \r\n',
      expected: { major: 17, minor: 2, raw: '17.2' },
    },
    {
      text: 'pg_dump (PostgreSQL) 9.6.24',
      expected: { major: 9, minor: 6, raw: '9.6.24' },
    },
    {
      text: 'pg_dump (PostgreSQL) 19devel',
      expected: { major: 19, raw: '19devel' },
    },
  ])('parses $text', ({ text, expected }) => {
    expect(parsePgDumpVersion(text)).toEqual(expected);
  });

  it('only quotes the start of what it cannot read', () => {
    const error = thrownBy(() =>
      parsePgDumpVersion(`garbage ${'x'.repeat(500)}`)
    );

    expect(error).toMatchObject({ code: 'PG_DUMP_FAILED' });
    expect(messageOf(error)).toContain('garbage xxx');
    expect(messageOf(error)).not.toContain('x'.repeat(200));
    expect(messageOf(error)).toContain('--pg-dump');
    expect(messageOf(error)).toContain('--from-file');
  });
});

describe('assertPgDumpCompatible', () => {
  it('says what to do with a pg_dump that is too old', () => {
    const error = thrownBy(() => {
      assertPgDumpCompatible(
        { major: 13, minor: 0, raw: '13.0' },
        160_004,
        '16.4'
      );
    });

    expect(error).toMatchObject({ code: 'PG_DUMP_TOO_OLD' });
    expect(messageOf(error)).toContain('pg_dump 16 or newer');
    expect(messageOf(error)).toContain('--pg-dump');
    expect(messageOf(error)).toContain('--from-file');
  });
});
