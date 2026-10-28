import { describe, expect, it } from 'vitest';
import {
  formatFakeCommand,
  quoteShellWord,
} from '../../../src/baseline/core/fakeCommand';

describe('formatFakeCommand', () => {
  it('quotes a migration name that needs it', () => {
    expect(formatFakeCommand('1700000000000_init schema', 'migrations')).toBe(
      "node-pg-migrate up '1700000000000_init schema' --fake"
    );
  });

  it.each(['./migrations', 'migrations/', 'Migrations'])(
    'adds the directory %s, which is not written like the default one',
    (dir) => {
      expect(formatFakeCommand('1_baseline', dir)).toBe(
        `node-pg-migrate up 1_baseline --fake -m ${dir}`
      );
    }
  );
});

describe('quoteShellWord', () => {
  it.each([
    { word: 'db/migrations-v2.1', expected: 'db/migrations-v2.1' },
    { word: 'user@host:path,a+b%', expected: 'user@host:path,a+b%' },
    { word: '', expected: "''" },
    { word: '~/migrations', expected: "'~/migrations'" },
    { word: '=cmd', expected: "'=cmd'" },
    { word: 'migrações', expected: "'migrações'" },
    { word: "it's", expected: String.raw`'it'\''s'` },
  ])('quotes $word as $expected', ({ word, expected }) => {
    expect(quoteShellWord(word)).toBe(expected);
  });
});
