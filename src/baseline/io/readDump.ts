import { readFile } from 'node:fs/promises';
import { text } from 'node:stream/consumers';

/**
 * The byte order mark some editors put at the start of UTF-8 files.
 */
const BYTE_ORDER_MARK = /^\uFEFF/;

/**
 * Reads a dump file as UTF-8, or all of `stdin` when `path` is `'-'`.
 *
 * A byte order mark at the start is left out either way: it is not SQL, and
 * pg_dump never writes one.
 *
 * @param path The dump file, or `'-'` for standard input.
 * @param stdin The stream `'-'` reads to its end. Defaults to
 * `process.stdin`.
 */
export async function readDumpFile(
  path: string,
  stdin: NodeJS.ReadableStream = process.stdin
): Promise<string> {
  const dump = path === '-' ? await text(stdin) : await readFile(path, 'utf8');

  return dump.replace(BYTE_ORDER_MARK, '');
}
