import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { PassThrough } from 'node:stream';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readDumpFile } from '../../../src/baseline/io/readDump';
import { CAPTURED_DUMPS } from '../helpers';

const TEXT =
  'CREATE DOMAIN public."bıgınt" AS bigint;\nCOMMENT ON SCHEMA "Sink Área" IS \'😀\';\n';

/**
 * Writes chunks to a stream one event-loop turn apart, then ends it.
 */
async function writeSlowly(
  stream: PassThrough,
  chunks: ReadonlyArray<Buffer>
): Promise<void> {
  for (const chunk of chunks) {
    await nextTurn();
    stream.write(chunk);
  }

  await nextTurn();
  stream.end();
}

describe('readDumpFile', () => {
  let dir = '';

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'pgm-read-dump-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads a file as UTF-8', async () => {
    const path = join(dir, 'dump.sql');
    writeFileSync(path, TEXT, 'utf8');

    await expect(readDumpFile(path)).resolves.toBe(TEXT);
  });

  it('reads a path relative to the current directory', async () => {
    const path = join(dir, 'relative.sql');
    writeFileSync(path, TEXT, 'utf8');

    await expect(readDumpFile(relative(process.cwd(), path))).resolves.toBe(
      TEXT
    );
  });

  it.each(CAPTURED_DUMPS.filter((dump) => dump.major === 18))(
    'reads the captured dump $name byte for byte',
    async ({ path, sql }) => {
      await expect(readDumpFile(path)).resolves.toBe(sql);
    }
  );

  it('reads the given stream to its end for -, even when a character is split across chunks', async () => {
    const bytes = Buffer.from(TEXT, 'utf8');
    const splitInsideArea = bytes.indexOf(Buffer.from('Área')) + 1;
    const splitInsideEmoji = bytes.indexOf(Buffer.from('😀')) + 2;
    const stream = new PassThrough();

    await Promise.all([
      expect(readDumpFile('-', stream)).resolves.toBe(TEXT),
      writeSlowly(stream, [
        bytes.subarray(0, splitInsideArea),
        bytes.subarray(splitInsideArea, splitInsideEmoji),
        bytes.subarray(splitInsideEmoji),
      ]),
    ]);
  });

  it('reads an empty stream for -', async () => {
    const stream = new PassThrough();
    stream.end();

    await expect(readDumpFile('-', stream)).resolves.toBe('');
  });
});
