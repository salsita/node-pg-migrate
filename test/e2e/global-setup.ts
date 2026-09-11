import { rm } from 'node:fs/promises';
import { RAW_COVERAGE_DIR } from './utils';

/**
 * Removes the raw V8 coverage of earlier e2e runs, so that
 * `report-coverage.mjs` only reports on this one.
 */
export async function setup(): Promise<void> {
  await rm(RAW_COVERAGE_DIR, { recursive: true, force: true });
}
