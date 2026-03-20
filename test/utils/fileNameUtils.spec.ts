import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '../../src/logger';
import { getNumericPrefix, getSuffixFromFileName } from '../../src/utils';

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

  it('returns empty string for dotfiles without extension', () => {
    expect(getSuffixFromFileName('.bashrc')).toBe('');
  });
});

describe('getNumericPrefix', () => {
  const logger: Logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  it('should allow any non-numeric character as a separator', () => {
    expect(getNumericPrefix('1-line-as-separator.js', logger)).toBe(1);
    expect(getNumericPrefix('2_underscore-as-separator.ts', logger)).toBe(2);
    expect(getNumericPrefix('3 space-as-separator.sql', logger)).toBe(3);
  });

  it('should fail with a non-numeric value', () => {
    const prefix = 'invalid-prefix';
    expect(() => getNumericPrefix(prefix, logger)).toThrow(
      new Error(`Cannot determine numeric prefix for "${prefix}"`)
    );
  });

  it('should get timestamp for normal timestamp', () => {
    const now = Date.now();
    expect(getNumericPrefix(String(now), logger)).toBe(now);
  });

  it('should get timestamp for shortened iso format', () => {
    const now = new Date();

    expect(getNumericPrefix(now.toISOString().replace(/\D/g, ''), logger)).toBe(
      now.valueOf()
    );
  });

  it('should get prefix for index strings', () => {
    expect(getNumericPrefix('0001', logger)).toBe(1);
    expect(getNumericPrefix('1234', logger)).toBe(1234);
  });
});
