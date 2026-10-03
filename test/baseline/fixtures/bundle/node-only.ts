// A module that only runs on Node.js, for the spec of `browserBundleImports()`
// (test/baseline/catalogs.bundle.spec.ts): it imports a Node.js built-in and
// a package, and uses the Node.js globals that browsers do not have. The
// local variable and the string named `global` must not count.
import { join } from 'node:path';
import pg from 'pg';

/**
 * Uses everything a browser does not have.
 *
 * @returns Something made with each of them.
 */
export function nodeOnly(): unknown[] {
  const local = (global: string): string => `global ${global}`;

  return [
    join(process.cwd(), __dirname, __filename),
    Buffer.byteLength(local('x')),
    pg.Client,
    globalThis.process.env,
    typeof require,
  ];
}
