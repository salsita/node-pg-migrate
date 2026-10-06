import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BaselineOptions } from '../../src';
import { baseline } from '../../src';
import type { LogFn } from '../../src/logger';
import { adversarialPath } from './helpers';

/**
 * A dump that is a valid baseline on its own (no migrations table, no data),
 * so `baseline()` writes the file and we can read the printed `--fake`
 * command off the result and out of the file's header.
 */
const DUMP = adversarialPath('comment-on-extension.sql');

/**
 * A `-t` option anywhere in a command, as its own word.
 */
const TABLE_OPTION = /(?:^|\s)-t\s/;

/**
 * A logger that records nothing (baseline writes the file regardless).
 */
function silentLogger(): { info: LogFn; warn: LogFn; error: LogFn } {
  return { info: vi.fn<LogFn>(), warn: vi.fn<LogFn>(), error: vi.fn<LogFn>() };
}

describe('the printed --fake command keeps the table and schema options', () => {
  let root = '';

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'pgm-fake-command-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /**
   * Writes a baseline from the dump with the given options and returns the
   * printed `--fake` command and the file it was written into.
   *
   * @param options Where the migration history lives.
   * @param sub A unique subdirectory so each call writes to an empty one.
   */
  async function fakeCommandFor(
    options: Pick<
      BaselineOptions,
      'migrationsTable' | 'migrationsSchema' | 'schema'
    >,
    sub: string
  ): Promise<{ fakeCommand: string; header: string }> {
    const dir = join(root, sub);
    const result = await baseline({
      ...options,
      dir,
      fromFile: DUMP,
      logger: silentLogger(),
    });

    return {
      fakeCommand: result.fakeCommand,
      header: readFileSync(result.path, 'utf8'),
    };
  }

  it('adds -t <table> when the migrations table is not pgmigrations', async () => {
    const { fakeCommand, header } = await fakeCommandFor(
      { migrationsTable: 'custom_migrations' },
      'custom-table'
    );

    expect(fakeCommand).toContain('-t custom_migrations');
    // Default schema: no schema option.
    expect(fakeCommand).not.toContain('--migrations-schema');
    // The same command goes into the file's header.
    expect(header).toContain('-t custom_migrations');
  });

  it('adds --migrations-schema <schema> when the migrations schema is not public', async () => {
    const { fakeCommand, header } = await fakeCommandFor(
      { migrationsSchema: 'audit' },
      'custom-schema'
    );

    expect(fakeCommand).toContain('--migrations-schema audit');
    // Default table: no -t option.
    expect(fakeCommand).not.toMatch(TABLE_OPTION);
    expect(header).toContain('--migrations-schema audit');
  });

  it('adds --migrations-schema for the migrations schema that the first schema gives', async () => {
    const { fakeCommand } = await fakeCommandFor(
      { schema: ['app', 'other'] },
      'first-schema'
    );

    expect(fakeCommand).toContain('--migrations-schema app');
    expect(fakeCommand).not.toMatch(TABLE_OPTION);
  });

  it('adds neither option for the defaults', async () => {
    const { fakeCommand } = await fakeCommandFor(
      { migrationsTable: 'pgmigrations', migrationsSchema: 'public' },
      'defaults'
    );

    expect(fakeCommand).not.toMatch(TABLE_OPTION);
    expect(fakeCommand).not.toContain('--migrations-schema');
  });

  it('adds both -t and --migrations-schema when both differ from the defaults', async () => {
    const { fakeCommand, header } = await fakeCommandFor(
      { migrationsTable: 'custom_migrations', migrationsSchema: 'audit' },
      'both'
    );

    expect(fakeCommand).toContain('-t custom_migrations');
    expect(fakeCommand).toContain('--migrations-schema audit');
    expect(header).toContain('-t custom_migrations');
    expect(header).toContain('--migrations-schema audit');
  });

  it('shell-quotes a migrations table and schema that need it', async () => {
    const { fakeCommand } = await fakeCommandFor(
      { migrationsTable: 'weird table', migrationsSchema: 'My Schema' },
      'quoted'
    );

    expect(fakeCommand).toContain("-t 'weird table'");
    expect(fakeCommand).toContain("--migrations-schema 'My Schema'");
  });
});
