import { readFile } from 'node:fs/promises';
import { buffer } from 'node:stream/consumers';
import { decodeDump } from '../core/decode';

/**
 * The byte order mark some editors put at the start of UTF-8 files.
 */
const BYTE_ORDER_MARK = /^\uFEFF/;

/**
 * What to do about a dump that is not UTF-8 (see `decodeDump()`).
 */
const NOT_UTF8_REMEDY =
  'Make the dump with pg_dump --encoding=UTF8, or convert it to UTF-8 (e.g. iconv -f LATIN1 -t UTF-8).';

/**
 * Reads a dump file, or all of `stdin` when `path` is `'-'`, as UTF-8 (see
 * `decodeDump()`).
 *
 * A byte order mark at the start is left out either way: it is not SQL, and
 * pg_dump never writes one.
 *
 * Throws a `BaselineError` with code `NOT_UTF8` when the dump is not UTF-8
 * text.
 *
 * @param path The dump file, or `'-'` for standard input.
 * @param stdin The stream `'-'` reads to its end. Defaults to
 * `process.stdin`.
 */
export async function readDumpFile(
  path: string,
  stdin: NodeJS.ReadableStream = process.stdin
): Promise<string> {
  const bytes = path === '-' ? await buffer(stdin) : await readFile(path);

  return decodeDump(bytes, NOT_UTF8_REMEDY).replace(BYTE_ORDER_MARK, '');
}
