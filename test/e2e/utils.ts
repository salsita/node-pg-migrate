import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { constants, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export {
  createDatabase,
  databaseUrl,
  dumpSchema,
  ensureRole,
  filterIgnoredLines,
  loadFixture,
  loadSql,
  PG_VERSIONS,
  psqlSelect,
  SCHEMA_FIXTURES,
  setupPostgresDatabase,
} from '../integration/utils';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

/**
 * The CLI built by `pnpm run build`. The path is absolute so that tests can run
 * it from any working directory.
 */
const CLI_PATH = resolve(REPO_ROOT, 'bin/node-pg-migrate.js');

/**
 * Where the CLI processes started by {@link runCli} write their raw V8 coverage
 * when `PGM_E2E_COVERAGE` is set.
 *
 * `global-setup.ts` empties it before each run and `report-coverage.mjs` (which
 * has its own copy of this path) turns it into `coverage/e2e/lcov.info`.
 */
export const RAW_COVERAGE_DIR: string = resolve(REPO_ROOT, 'coverage/e2e/raw');

/**
 * Timeout for e2e tests and hooks in milliseconds, from the `E2E_TIMEOUT`
 * environment variable. Defaults to 3 minutes, like the e2e project in
 * `vitest.config.ts`.
 */
export const E2E_TIMEOUT = Number(process.env.E2E_TIMEOUT ?? 180_000);

/**
 * The outcome of a CLI run.
 */
export interface CliResult {
  /**
   * The exit code, or 128 + the signal number when a signal killed the process.
   */
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Runs the built CLI (`bin/node-pg-migrate.js`) in a child process, with the
 * Node.js binary that runs the tests.
 *
 * The child's environment is `process.env` merged with `options.env` (an
 * `undefined` value removes a variable). When `PGM_E2E_COVERAGE` is set,
 * `NODE_V8_COVERAGE` always points to {@link RAW_COVERAGE_DIR}, so every run
 * counts towards the e2e coverage.
 *
 * @param args The CLI arguments, e.g. `['up', '-m', dir]`.
 * @param options Optional settings.
 * @param options.env Environment variables to add or override.
 * @param options.cwd The working directory. Defaults to the repository root.
 * @param options.input Text written to the CLI's stdin. Stdin is closed
 * afterwards, or right away without `input`.
 *
 * @returns The exit code and output. A non-zero exit code does not reject.
 */
export function runCli(
  args: ReadonlyArray<string>,
  options: {
    readonly env?: NodeJS.ProcessEnv;
    readonly cwd?: string;
    readonly input?: string;
  } = {}
): Promise<CliResult> {
  const env: NodeJS.ProcessEnv = { ...process.env, ...options.env };
  if (process.env.PGM_E2E_COVERAGE) {
    env.NODE_V8_COVERAGE = RAW_COVERAGE_DIR;
  }

  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      cwd: options.cwd ?? REPO_ROOT,
      env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('error', reject);
    child.on('close', (code, signal) => {
      resolveResult({
        code: code ?? 128 + (signal === null ? 0 : constants.signals[signal]),
        stdout,
        stderr,
      });
    });

    // A CLI that exits without reading its input closes the pipe early.
    child.stdin.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code !== 'EPIPE') {
        reject(error);
      }
    });
    child.stdin.end(options.input);
  });
}

/**
 * Quotes a value for a POSIX shell.
 *
 * @param value The value to quote.
 *
 * @returns The value in single quotes.
 */
function shellQuote(value: string): string {
  return `'${value.replaceAll("'", String.raw`'\''`)}'`;
}

/**
 * Writes an executable `pg_dump` shim that runs the `pg_dump` inside the given
 * container, so the dump always comes from the server's own version.
 *
 * The shim runs `docker exec -i -e PGUSER -e PGPASSWORD -e PGDATABASE <container
 * id> pg_dump "$@"`. `PGHOST` and `PGPORT` are not forwarded on purpose: inside
 * the container, pg_dump connects through the local socket.
 *
 * @param container The PostgreSQL container to run pg_dump in.
 * @param options Optional settings.
 * @param options.reportVersion Makes `pg_dump --version` print
 * `pg_dump (PostgreSQL) <reportVersion>` instead, e.g. to fake an old pg_dump.
 *
 * @returns The path of the shim, in a new temporary directory.
 */
export async function pgDumpShim(
  container: StartedPostgreSqlContainer,
  options: { readonly reportVersion?: string } = {}
): Promise<string> {
  const lines = ['#!/bin/sh'];
  if (options.reportVersion !== undefined) {
    lines.push(
      'if [ "$1" = "--version" ]; then',
      `  echo ${shellQuote(`pg_dump (PostgreSQL) ${options.reportVersion}`)}`,
      '  exit 0',
      'fi'
    );
  }

  lines.push(
    `exec docker exec -i -e PGUSER -e PGPASSWORD -e PGDATABASE ${container.getId()} pg_dump "$@"`
  );

  const dir = await mkdtemp(join(tmpdir(), 'pgm-pg-dump-'));
  const path = join(dir, 'pg_dump');
  await writeFile(path, `${lines.join('\n')}\n`, { mode: 0o755 });

  return path;
}
