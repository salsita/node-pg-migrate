import { isUtf8 } from 'node:buffer';
import { BaselineError } from '../errors';

/**
 * The line feed byte. UTF-8 never uses it inside a multibyte character, so
 * the lines of a dump can be checked one by one.
 */
const LINE_FEED = 0x0a;

/**
 * The line of the first byte that is not UTF-8, in a dump that has one.
 *
 * @param bytes The dump.
 */
function firstNonUtf8Line(bytes: Buffer): number {
  let line = 1;
  let start = 0;
  for (
    let end = bytes.indexOf(LINE_FEED);
    end !== -1;
    end = bytes.indexOf(LINE_FEED, start)
  ) {
    if (!isUtf8(bytes.subarray(start, end))) {
      return line;
    }

    line += 1;
    start = end + 1;
  }

  // Every line before it is UTF-8, so it is on the last line.
  return line;
}

/**
 * Decodes a dump, which must be UTF-8 text. pg_dump writes in the encoding of
 * the database (or of `PGCLIENTENCODING`) unless it is told to write UTF-8,
 * and reading another encoding as UTF-8 would change every non-ASCII
 * character into U+FFFD: the baseline would silently differ from the
 * database.
 *
 * Bytes with a NUL byte are decoded anyway, with U+FFFD for what is not
 * UTF-8: they are not text at all (a pg_dump archive, a compressed file or
 * UTF-16 text), which `sanitizeDump()` refuses, saying what they are.
 *
 * Throws a `BaselineError` with code `NOT_UTF8`, naming the line of the first
 * byte that is not UTF-8, for any other dump that is not UTF-8.
 *
 * @param bytes The dump.
 * @param remedy What to do about a dump that is not UTF-8, for the message.
 */
export function decodeDump(bytes: Buffer, remedy: string): string {
  if (bytes.includes(0) || isUtf8(bytes)) {
    return bytes.toString('utf8');
  }

  throw new BaselineError(
    'NOT_UTF8',
    `line ${firstNonUtf8Line(bytes)}: the dump is not UTF-8 text, and reading it as UTF-8 would change its non-ASCII characters. ${remedy}`
  );
}
