/**
 * Reads a dump file as UTF-8, or all of `stdin` when `path` is `'-'`.
 *
 * @param path The dump file, or `'-'` for standard input.
 * @param stdin The stream `'-'` reads to its end. Defaults to
 * `process.stdin`.
 */
export function readDumpFile(
  _path: string,
  _stdin?: NodeJS.ReadableStream
): Promise<string> {
  return Promise.reject(new Error('not implemented'));
}
