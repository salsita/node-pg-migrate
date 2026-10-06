import { isAbsolute } from 'node:path';
import { Rolldown } from 'tsdown';

/**
 * The start of the module that {@link browserBundleImports} makes a Node.js
 * global come from, e.g. `node-global:process`.
 */
export const NODE_GLOBAL = 'node-global:';

/**
 * Globals that Node.js has and browsers do not.
 */
const NODE_GLOBALS: ReadonlyArray<string> = [
  'process',
  'Buffer',
  'global',
  'require',
  '__dirname',
  '__filename',
];

/**
 * Makes each of {@link NODE_GLOBALS}, bare or through `globalThis`, the
 * default import of `node-global:<name>` (see rolldown's `transform.inject`).
 * Only references to the global are rewritten, not a local variable with its
 * name, nor its name in a string or a comment.
 */
const INJECT_NODE_GLOBALS: Record<string, [string, string]> =
  Object.fromEntries(
    NODE_GLOBALS.flatMap((name) => [
      [name, [`${NODE_GLOBAL}${name}`, 'default']],
      [`globalThis.${name}`, [`${NODE_GLOBAL}${name}`, 'default']],
    ])
  );

/**
 * Whether the bundle leaves a module out and imports it: every module that
 * is not a file, so Node.js built-ins (`node:path`, `fs`, …), packages (`pg`,
 * `glob`, …) and the `node-global:` modules. A browser bundler would try to
 * inline those or fail, while the point is to see them.
 *
 * @param id The module as the import names it.
 */
function isLeftOut(id: string): boolean {
  return !id.startsWith('.') && !isAbsolute(id) && !id.startsWith('\0');
}

/**
 * Bundles a module for the browser with rolldown (what tsdown builds with),
 * and lists what the bundle still imports: the Node.js built-ins and packages
 * it needs, and a `node-global:<name>` module for each Node.js global it uses
 * (`process`, `Buffer`, `global`, `require`, `__dirname`, `__filename`). Code
 * that runs in a browser without polyfills imports none of them.
 *
 * @param entry The absolute path of the module (TypeScript or JavaScript).
 * @returns The imported modules, static and dynamic, sorted and without
 * duplicates; none for a module that only needs its own files.
 */
export async function browserBundleImports(entry: string): Promise<string[]> {
  const bundle = await Rolldown.rolldown({
    input: entry,
    platform: 'browser',
    logLevel: 'silent',
    external: isLeftOut,
    transform: { inject: INJECT_NODE_GLOBALS },
  });

  try {
    const { output } = await bundle.generate({ format: 'esm' });
    // The chunks import each other too, when the bundle has more than one.
    const files = new Set(output.map((file) => file.fileName));
    const chunks = output.filter((file) => file.type === 'chunk');
    const imports = new Set([
      ...chunks.flatMap((chunk) => chunk.imports),
      ...chunks.flatMap((chunk) => chunk.dynamicImports),
    ]);

    return [...imports].filter((id) => !files.has(id)).toSorted();
  } finally {
    await bundle.close();
  }
}
