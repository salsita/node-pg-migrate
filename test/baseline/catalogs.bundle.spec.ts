import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { browserBundleImports } from './browserBundle';

// `node-pg-migrate/baseline/catalogs` runs in browsers (e.g. npgm studio,
// against PGlite), so its source must bundle for the browser with nothing
// left to import: no Node.js built-in (`node:*`, `fs`, `path`,
// `child_process`, …), no package (`pg`, `glob`, `jiti`, `commander`) and no
// Node.js global (`process`, `Buffer`, …). The same check runs on the built
// entry in test/e2e/baseline-catalogs.spec.ts.

/**
 * The source of the entry.
 */
const CATALOGS_ENTRY = resolve(
  import.meta.dirname,
  '../../src/baseline/catalogs.ts'
);

/**
 * A module that uses everything a browser does not have.
 */
const NODE_ONLY_MODULE = resolve(
  import.meta.dirname,
  'fixtures/bundle/node-only.ts'
);

describe('browserBundleImports()', () => {
  it('lists the Node.js built-ins, packages and globals a module uses', async () => {
    expect(await browserBundleImports(NODE_ONLY_MODULE)).toEqual([
      'node-global:Buffer',
      'node-global:__dirname',
      'node-global:__filename',
      'node-global:process',
      'node-global:require',
      'node:path',
      'pg',
    ]);
  });
});

describe('src/baseline/catalogs.ts', () => {
  it('bundles for the browser with nothing left to import', async () => {
    expect(await browserBundleImports(CATALOGS_ENTRY)).toEqual([]);
  });
});
