'use strict';

/**
 * `oxlint-plugin-organize-imports` drives the TypeScript *JavaScript* language
 * service, which TypeScript 7 (the Go port) no longer ships, so it declares a
 * `typescript: ^5 || ^6` peer dependency. This repo is on TypeScript 7 for
 * `tsc` and tsgolint, and pnpm would resolve that peer to the root's 7.x.
 *
 * Rewrite the peer into a regular dependency so the plugin gets its own nested
 * TypeScript 6 and everything else keeps using TypeScript 7. Drop this hook
 * once the plugin supports TypeScript 7.
 */
const ORGANIZE_IMPORTS_TYPESCRIPT = '6.0.3';

function readPackage(pkg) {
  if (pkg.name === 'oxlint-plugin-organize-imports') {
    delete pkg.peerDependencies.typescript;
    pkg.dependencies = {
      ...pkg.dependencies,
      typescript: ORGANIZE_IMPORTS_TYPESCRIPT,
    };
  }

  return pkg;
}

module.exports = { hooks: { readPackage } };
