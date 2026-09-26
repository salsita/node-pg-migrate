import { existsSync } from 'node:fs';
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it, onTestFinished } from 'vitest';
import type { CliResult } from './utils';
import { runCli } from './utils';

// CLI refusals that don't need a database: a glob migrations-dir, a dump file
// with an unreachable configured connection, and that a refused baseline
// leaves no directory behind.

const ADVERSARIAL_DIR = resolve(
  import.meta.dirname,
  '../baseline/fixtures/adversarial'
);

/**
 * A valid baseline dump (no migrations table, no data).
 */
const VALID_DUMP = join(ADVERSARIAL_DIR, 'comment-on-extension.sql');

/**
 * A dump that recreates the migrations table, which baseline refuses with a
 * `BaselineError`.
 */
const TABLE_IN_DUMP = join(ADVERSARIAL_DIR, 'migrations-table.sql');

/**
 * Environment of a CLI run without any database connection.
 */
const NO_CONNECTION: NodeJS.ProcessEnv = {
  DATABASE_URL: undefined,
  PGHOST: undefined,
  PGPORT: undefined,
  PGUSER: undefined,
  PGPASSWORD: undefined,
  PGDATABASE: undefined,
};

/**
 * A frame of a stack trace, as Node.js prints it.
 */
const STACK_FRAME = /^ {4}at /m;

/**
 * Creates a temporary directory that is removed when the current test
 * finishes.
 *
 * @returns The path of the directory.
 */
async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pgm-e2e-baseline-refusal-'));
  onTestFinished(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  return dir;
}

/**
 * Checks that a run was refused with a message for the user: exit code 1 and
 * a message on stderr, without a stack trace.
 *
 * @param result The run.
 * @param fragments What the message must contain.
 */
function expectRefusal(
  result: CliResult,
  fragments: ReadonlyArray<string | RegExp>
): void {
  expect(result.code, result.stderr).toBe(1);
  for (const fragment of fragments) {
    expect(result.stderr).toMatch(fragment);
  }

  expect(result.stderr).not.toMatch(STACK_FRAME);
  expect(result.stderr).not.toContain('BaselineError');
}

describe('baseline refuses a glob migrations-dir', () => {
  it('refuses use-glob from the configuration and writes nothing', async () => {
    const cwd = await tempDir();
    await copyFile(VALID_DUMP, join(cwd, 'schema.sql'));
    await writeFile(
      join(cwd, 'cfg.json'),
      JSON.stringify({ 'migrations-dir': 'migrations/*.sql', 'use-glob': true })
    );

    const result = await runCli(
      ['baseline', '--from-file', 'schema.sql', '--config-file', 'cfg.json'],
      { cwd, env: NO_CONNECTION }
    );

    expectRefusal(result, [/glob/i, /director/i]);
    // No literal `migrations/*.sql` directory is created.
    expect(existsSync(join(cwd, 'migrations'))).toBe(false);
  });

  it('refuses use-glob from the configuration even for a plain directory', async () => {
    const cwd = await tempDir();
    await copyFile(VALID_DUMP, join(cwd, 'schema.sql'));
    await writeFile(
      join(cwd, 'cfg.json'),
      JSON.stringify({ 'migrations-dir': 'migrations', 'use-glob': true })
    );

    const result = await runCli(
      ['baseline', '--from-file', 'schema.sql', '--config-file', 'cfg.json'],
      { cwd, env: NO_CONNECTION }
    );

    expectRefusal(result, [/glob/i, /director/i]);
    expect(existsSync(join(cwd, 'migrations'))).toBe(false);
  });

  it('refuses a migrations-dir with glob characters and writes nothing', async () => {
    const cwd = await tempDir();
    await copyFile(VALID_DUMP, join(cwd, 'schema.sql'));

    const result = await runCli(
      ['baseline', '--from-file', 'schema.sql', '-m', 'db/migrations/**/*.sql'],
      { cwd, env: NO_CONNECTION }
    );

    expectRefusal(result, [/glob/i, /director/i]);
    expect(existsSync(join(cwd, 'db'))).toBe(false);
  });
});

describe('baseline --from-file with an unreachable configured connection', () => {
  it('refuses without a stack trace, naming the host and database but not the password', async () => {
    const cwd = await tempDir();
    await copyFile(VALID_DUMP, join(cwd, 'schema.sql'));

    const result = await runCli(
      ['baseline', '--from-file', 'schema.sql', '-m', 'migrations'],
      {
        cwd,
        env: {
          ...NO_CONNECTION,
          DATABASE_URL: 'postgres://appuser:s3cr3t@127.0.0.1:1/appdb',
        },
      }
    );

    expectRefusal(result, ['127.0.0.1', 'appdb']);
    // The password is never shown.
    expect(result.stderr).not.toContain('s3cr3t');
    // Nothing is written, not even the directory.
    expect(existsSync(join(cwd, 'migrations'))).toBe(false);
  });
});

describe('a refused baseline leaves no migrations directory', () => {
  it('does not create the directory when the dump is refused', async () => {
    const cwd = await tempDir();
    await copyFile(TABLE_IN_DUMP, join(cwd, 'mt.sql'));

    const result = await runCli(
      ['baseline', '--from-file', 'mt.sql', '-m', 'fresh_dir'],
      { cwd, env: NO_CONNECTION }
    );

    expectRefusal(result, ['pgmigrations']);
    expect(existsSync(join(cwd, 'fresh_dir'))).toBe(false);
  });
});
