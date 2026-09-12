import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';
import { RAW_COVERAGE_DIR } from './utils';

/**
 * Removes the raw V8 coverage of earlier e2e runs, so that
 * `report-coverage.mjs` only reports on this one, and makes the directory
 * that `pgDumpShim()` writes its shims to during this run.
 *
 * @param project The e2e project, which passes the directory to the tests.
 *
 * @returns The teardown, which removes that directory with every shim in it
 * once all e2e tests have run.
 */
export async function setup(
  project: TestProject
): Promise<() => Promise<void>> {
  await rm(RAW_COVERAGE_DIR, { recursive: true, force: true });

  const shimDir = await mkdtemp(join(tmpdir(), 'pgm-e2e-pg-dump-'));
  project.provide('pgDumpShimDir', shimDir);

  return async () => {
    await rm(shimDir, { recursive: true, force: true });
  };
}
