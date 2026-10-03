import { readFile } from 'node:fs/promises';
import { buffer } from 'node:stream/consumers';
import { decodeDump } from '../core/decode';
import { BaselineError } from '../errors';

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
 * Why a dump file could not be read, by the code of the error.
 */
const READ_FAILURES: Readonly<Partial<Record<string, string>>> = {
  ENOENT: 'it does not exist',
  ENOTDIR: 'a part of its path is not a directory',
  EISDIR: 'it is a directory',
  EACCES: 'permission denied',
  EPERM: 'permission denied',
};

/**
 * Why a dump file could not be read: the usual errors in words, others as
 * their own message.
 *
 * @param error What reading the file threw.
 */
function readFailure(error: unknown): string {
  if (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return READ_FAILURES[error.code] ?? error.message;
  }

  return String(error);
}

/**
 * Reads the bytes of a dump file.
 *
 * Throws a `BaselineError` with code `INVALID_OPTIONS` when it cannot be read,
 * e.g. it does not exist or is a directory. Named pipes (such as the
 * `/dev/fd/N` of a shell's `<(pg_dump …)`) are read to their end.
 *
 * @param path The dump file, as the user gave it.
 */
async function readBytes(path: string): Promise<Buffer> {
  try {
    return await readFile(path);
  } catch (error) {
    throw new BaselineError(
      'INVALID_OPTIONS',
      `Could not read the dump ${path}: ${readFailure(error)}. Pass a pg_dump --schema-only output, or - to read it from standard input.`,
      { cause: error }
    );
  }
}

/**
 * Reads a dump file, or all of `stdin` when `path` is `'-'`, as UTF-8 (see
 * `decodeDump()`).
 *
 * A byte order mark at the start is left out either way: it is not SQL, and
 * pg_dump never writes one.
 *
 * Throws a `BaselineError` with code `INVALID_OPTIONS` when the file cannot
 * be read, and `NOT_UTF8` when the dump is not UTF-8 text.
 *
 * @param path The dump file, or `'-'` for standard input.
 * @param stdin The stream `'-'` reads to its end. Defaults to
 * `process.stdin`.
 */
export async function readDumpFile(
  path: string,
  stdin: NodeJS.ReadableStream = process.stdin
): Promise<string> {
  const bytes = path === '-' ? await buffer(stdin) : await readBytes(path);

  return decodeDump(bytes, NOT_UTF8_REMEDY).replace(BYTE_ORDER_MARK, '');
}
