import { describe, expect, it } from 'vitest';
import { normalizeDump } from '../../../src/baseline/core/normalize';
import { CAPTURED_DUMPS } from '../helpers';

/**
 * What normalizing has to give: the dump without the `\restrict` /
 * `\unrestrict` lines and the two version comments, line by line.
 */
function withoutVolatileLines(dump: string): string {
  return dump
    .split('\n')
    .filter(
      (line) =>
        !/^\\(?:un)?restrict /.test(line) &&
        !/^-- Dumped (?:from database|by pg_dump) version /.test(line)
    )
    .join('\n');
}

/**
 * The captured dump of a fixture on a major version.
 */
function dumpOf(major: number, fixture: string): string {
  const dump = CAPTURED_DUMPS.find(
    (candidate) => candidate.major === major && candidate.fixture === fixture
  );
  if (dump === undefined) {
    throw new Error(`no captured dump for ${fixture} on ${major}`);
  }

  return dump.sql;
}

describe('normalizeDump', () => {
  it('removes the \\restrict and \\unrestrict lines and the version comments', () => {
    expect(
      normalizeDump(
        '--\n-- PostgreSQL database dump\n--\n\n\\restrict k3y\n\n-- Dumped from database version 18.6\n-- Dumped by pg_dump version 18.6\n\nSET row_security = off;\n\n\\unrestrict k3y\n\n'
      )
    ).toBe(
      '--\n-- PostgreSQL database dump\n--\n\n\n\nSET row_security = off;\n\n\n'
    );
  });

  it('keeps other backslash lines and other comments', () => {
    const sql =
      "-- Dumped by hand\n-- Dumped from memory\n\\connect app\nCOMMENT ON TABLE public.t IS 'restrict';\n";

    expect(normalizeDump(sql)).toBe(sql);
  });

  it.each(CAPTURED_DUMPS)(
    'removes only the volatile lines of $name',
    ({ sql }) => {
      expect(normalizeDump(sql)).toBe(withoutVolatileLines(sql));
    }
  );

  it.each(CAPTURED_DUMPS)('is idempotent on $name', ({ sql }) => {
    const once = normalizeDump(sql);

    expect(normalizeDump(once)).toBe(once);
  });

  it.each([
    { fixture: 'pagila', majors: [15, 16] },
    { fixture: 'pagila', majors: [17, 18] },
    { fixture: 'chinook', majors: [14, 15] },
    { fixture: 'chinook', majors: [14, 16] },
    { fixture: 'chinook', majors: [17, 18] },
    { fixture: 'kitchen-sink', majors: [14, 15] },
  ])(
    'makes the $fixture dumps of PostgreSQL $majors equal',
    ({ fixture, majors: [first = 0, second = 0] }) => {
      const a = dumpOf(first, fixture);
      const b = dumpOf(second, fixture);

      expect(a).not.toBe(b);
      expect(normalizeDump(a)).toBe(normalizeDump(b));
    }
  );
});
