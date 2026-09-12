import { describe, expect, it } from 'vitest';
import { decodeDump } from '../../../src/baseline/core/decode';
import { BaselineError } from '../../../src/baseline/errors';
import { escapeRegExp, messageOf, thrownBy } from '../helpers';

/**
 * What to do about a dump that is not UTF-8, as the caller says it.
 */
const REMEDY = 'Make the dump again with pg_dump --encoding=UTF8.';

/**
 * `café` in LATIN1: its `é` is the single byte 0xE9, which is not UTF-8.
 */
const LATIN1_CAFE = Buffer.from([0x63, 0x61, 0x66, 0xe9]);

/**
 * The bytes of UTF-8 text and of other bytes, one after the other.
 */
function bytesOf(...parts: ReadonlyArray<string | Buffer>): Buffer {
  return Buffer.concat(
    parts.map((part) =>
      typeof part === 'string' ? Buffer.from(part, 'utf8') : part
    )
  );
}

describe('decodeDump', () => {
  it('decodes UTF-8 text', () => {
    const text = "COMMENT ON TABLE public.menu IS 'café 😀';\n";

    expect(decodeDump(bytesOf(text), REMEDY)).toBe(text);
  });

  it.each([
    {
      name: 'a line before the last one',
      bytes: bytesOf(
        'SELECT 1;\n',
        "COMMENT ON TABLE public.menu IS '",
        LATIN1_CAFE,
        "';\nSELECT 2;\n"
      ),
      line: 2,
    },
    {
      name: 'the last line, which has no line break',
      bytes: bytesOf(
        'SELECT 1;\nSELECT 2;\n',
        "COMMENT ON TABLE public.menu IS '",
        LATIN1_CAFE,
        "';"
      ),
      line: 3,
    },
    {
      name: 'the only line of a dump without a line break',
      bytes: LATIN1_CAFE,
      line: 1,
    },
    {
      name: 'a character cut short at the end of the dump',
      bytes: bytesOf('SELECT 1;\n', Buffer.from('é', 'utf8').subarray(0, 1)),
      line: 2,
    },
  ])(
    'refuses a byte that is not UTF-8 on $name, and names its line',
    ({ bytes, line }) => {
      const error = thrownBy(() => decodeDump(bytes, REMEDY));

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'NOT_UTF8' });
      expect(messageOf(error)).toMatch(
        new RegExp(
          `^line ${String(line)}: the dump is not UTF-8 text\\b.* ${escapeRegExp(REMEDY)}$`
        )
      );
    }
  );
});
