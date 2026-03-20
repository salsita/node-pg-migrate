import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '../../src/logger';
import {
  compareFileNamesByTimestamp,
  compareMigrationFileNames,
  getSuffixFromFileName,
} from '../../src/utils';

describe('getSuffixFromFileName', () => {
  it('extracts extension without the leading dot', () => {
    expect(getSuffixFromFileName('001_migration.js')).toBe('js');
    expect(getSuffixFromFileName('001_migration.sql')).toBe('sql');
  });

  it('returns empty string when there is no extension', () => {
    expect(getSuffixFromFileName('no-extension')).toBe('');
  });

  it('extracts only the last extension', () => {
    expect(getSuffixFromFileName('archive.tar.gz')).toBe('gz');
  });
});

describe('compareFileNamesByTimestamp', () => {
  const logger: Logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  it('compares by numeric prefix (index / timestamp modes)', () => {
    expect(compareFileNamesByTimestamp('2_a.js', '1_b.js')).toBeGreaterThan(0);
    expect(compareFileNamesByTimestamp('1_b.js', '2_a.js')).toBeLessThan(0);
  });

  it('returns 0 when the numeric prefixes match', () => {
    expect(compareFileNamesByTimestamp('0001_a.js', '1_b.js')).toBe(0);
  });

  it('throws when the first file has no numeric prefix', () => {
    expect(() =>
      compareFileNamesByTimestamp('invalid-prefix.js', '1_b.js', logger)
    ).toThrow(
      new Error('Cannot determine numeric prefix for "invalid-prefix.js"')
    );
  });
});

describe('compareMigrationFileNames', () => {
  const logger: Logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  it('orders by numeric prefix when they differ', () => {
    expect(
      compareMigrationFileNames('2_a.js', '1_b.js', logger)
    ).toBeGreaterThan(0);
    expect(compareMigrationFileNames('1_b.js', '2_a.js', logger)).toBeLessThan(
      0
    );
  });

  it('falls back to locale numeric compare for equal numeric prefixes', () => {
    const files = ['062_view_test.js', '062_view.js'].toSorted((a, b) =>
      compareMigrationFileNames(a, b)
    );

    expect(files).toEqual(['062_view.js', '062_view_test.js']);
  });

  it('orders by UTC timestamp when the numeric prefix is 17 digits', () => {
    const t1 = '20200513070724505';
    const t2 = '20200513070724506';

    const a = `${t1}_a.sql`;
    const b = `${t2}_b.sql`;

    expect(compareMigrationFileNames(a, b, logger)).toBeLessThan(0);
    expect(compareMigrationFileNames(b, a, logger)).toBeGreaterThan(0);
  });

  it('throws when the first file has no numeric prefix', () => {
    expect(() =>
      compareMigrationFileNames('invalid-prefix.js', '1_b.js', logger)
    ).toThrow(
      new Error('Cannot determine numeric prefix for "invalid-prefix.js"')
    );
  });
});
