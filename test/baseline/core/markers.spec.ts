import { describe, expect, it } from 'vitest';
import { findMigrationMarker } from '../../../src/baseline/core/markers';
import type { MarkerMatch } from '../../../src/baseline/core/markers';
import { createMigrationCommentRegex } from '../../../src/sqlMigration';

/**
 * The first marker node-pg-migrate's own regular expressions find: where the
 * `--` of the match is (the match itself starts at the beginning of a line,
 * before any whitespace) and where the match ends.
 */
function markerOfRegExps(text: string): MarkerMatch | undefined {
  const matches = (['up', 'down'] as const)
    .map((direction) => createMigrationCommentRegex(direction).exec(text))
    .filter((match) => match !== null)
    .map((match) => ({
      start: match.index + match[0].indexOf('--'),
      end: match.index + match[0].length,
    }));

  return matches.toSorted((a, b) => a.start - b.start)[0];
}

/**
 * The pieces the generated texts are made of: line breaks and whitespace of
 * all kinds (as JavaScript regular expressions see them), hyphens, and parts
 * of the marker words in both cases, with look-alike letters.
 */
const PIECES: ReadonlyArray<string> = [
  '-',
  '--',
  ' ',
  '\t',
  '\n',
  '\r',
  '\v',
  '\f',
  '\u00A0',
  '\u1680',
  '\u2000',
  '\u2028',
  '\u2029',
  '\u3000',
  '\uFEFF',
  'up',
  'UP',
  'Up',
  'down',
  'DOWN',
  'u',
  'p',
  'migration',
  'MIGRATION',
  'Migrations',
  'migratio',
  'm\u0131gration',
  'x',
  ';',
  '-- up',
  '\n-- down',
  ' migration',
];

/**
 * A pseudo-random number generator (Park and Miller's), so that the texts
 * are the same on every run.
 */
function random(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state * 48_271) % 2_147_483_647;

    return state / 2_147_483_647;
  };
}

/**
 * Texts made of random {@link PIECES}.
 */
function generatedTexts(count: number): string[] {
  const next = random(275);

  return Array.from({ length: count }, () =>
    Array.from(
      { length: Math.floor(next() * 24) },
      () => PIECES[Math.floor(next() * PIECES.length)]
    ).join('')
  );
}

describe('findMigrationMarker', () => {
  it.each([
    { text: '-- Up Migration', expected: { start: 0, end: 15 } },
    {
      text: 'x\n  --  down   MIGRATION later',
      expected: { start: 4, end: 24 },
    },
    { text: '--- up migration', expected: { start: 0, end: 16 } },
    { text: '\n\n\t-- up\tmigrations', expected: { start: 3, end: 18 } },
    { text: '--\n\n  up migration', expected: { start: 0, end: 18 } },
    { text: '-- -- - up migration', expected: { start: 0, end: 20 } },
    {
      text: 'a\u2028-- down migration',
      expected: { start: 2, end: 19 },
    },
  ])('finds the marker of $text', ({ text, expected }) => {
    expect(findMigrationMarker(text)).toEqual(expected);
  });

  it.each([
    '',
    'SELECT 1; -- up migration',
    '-- Upgrade migration',
    '-- Up-Migration',
    '-- upmigration',
    '-- up migratio',
    '-- up m\u0131gration',
    'x-- up migration',
    '- - up migration',
    '-- Name: up migration; Type: TABLE',
  ])('finds no marker in %j', (text) => {
    expect(findMigrationMarker(text)).toBeUndefined();
  });

  it('finds the markers node-pg-migrate finds, where it finds them', () => {
    const texts = generatedTexts(20_000);

    expect(
      texts.filter(
        (text) =>
          JSON.stringify(findMigrationMarker(text)) !==
          JSON.stringify(markerOfRegExps(text))
      )
    ).toEqual([]);
    expect(
      texts.filter((text) => findMigrationMarker(text) !== undefined).length
    ).toBeGreaterThan(500);
  });

  it('reads long runs of blank lines and hyphens once', () => {
    const blankLines = '\n'.repeat(400_000);

    expect(
      findMigrationMarker(`${'--\n'.repeat(200_000)}${' \n'.repeat(200_000)}x`)
    ).toBeUndefined();
    expect(findMigrationMarker('--x\n'.repeat(200_000))).toBeUndefined();
    expect(findMigrationMarker(`${blankLines}-- up migration`)).toEqual({
      start: 400_000,
      end: 400_015,
    });
  });
});
