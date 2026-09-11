import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaselineError } from '../../../src/baseline/errors';
import {
  planBaselineFile,
  writeBaselineFile,
} from '../../../src/baseline/io/writeBaseline';
import { messageOf, rejectionOf } from '../helpers';

/**
 * 2026-09-11T12:34:56.789Z, as `Date.now()` gives it.
 */
const NOW = Date.UTC(2026, 8, 11, 12, 34, 56, 789);

describe('planBaselineFile', () => {
  let root = '';

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'pgm-plan-baseline-'));
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(root, { recursive: true, force: true });
  });

  it('creates a missing directory and prefixes the name with a timestamp by default', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const dir = join(root, 'db', 'migrations');

    await expect(planBaselineFile({ dir, name: 'baseline' })).resolves.toEqual({
      migrationName: '1789130096789_baseline',
      path: join(dir, '1789130096789_baseline.sql'),
    });
    expect(statSync(dir).isDirectory()).toBe(true);
    expect(readdirSync(dir)).toEqual([]);
  });

  it.each([
    { filenameFormat: 'timestamp', prefix: '1789130096789' },
    { filenameFormat: 'utc', prefix: '20260911123456789' },
    { filenameFormat: 'index', prefix: '0001' },
  ] as const)(
    'prefixes the name like create does with the $filenameFormat format',
    async ({ filenameFormat, prefix }) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(NOW);

      await expect(
        planBaselineFile({ dir: root, name: 'initial-schema', filenameFormat })
      ).resolves.toEqual({
        migrationName: `${prefix}_initial-schema`,
        path: join(root, `${prefix}_initial-schema.sql`),
      });
    }
  );

  it('ignores files whose name starts with a dot', async () => {
    writeFileSync(join(root, '.gitkeep'), '');
    writeFileSync(join(root, '.DS_Store'), '');

    await expect(
      planBaselineFile({ dir: root, name: 'baseline', filenameFormat: 'index' })
    ).resolves.toEqual({
      migrationName: '0001_baseline',
      path: join(root, '0001_baseline.sql'),
    });
  });

  it('resolves a relative directory from the current directory', async () => {
    const dir = relative(process.cwd(), join(root, 'relative'));
    const { path, migrationName } = await planBaselineFile({
      dir,
      name: 'baseline',
    });

    expect(isAbsolute(path)).toBe(true);
    expect(path).toBe(resolve(root, 'relative', `${migrationName}.sql`));
  });

  it.each([
    { files: ['1700000000000_init.js'], count: 1 },
    { files: ['1700000000000_init.js', '1700000000001_users.sql'], count: 2 },
  ])(
    'refuses a directory with $count migration file(s)',
    async ({ files, count }) => {
      mkdirSync(join(root, 'migrations'));
      const dir = join(root, 'migrations');
      writeFileSync(join(dir, '.gitkeep'), '');
      for (const file of files) {
        writeFileSync(join(dir, file), '');
      }

      const error = await rejectionOf(
        planBaselineFile({ dir, name: 'baseline' })
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'MIGRATIONS_EXIST' });
      expect(messageOf(error)).toContain(dir);
      expect(messageOf(error)).toContain(`already has ${count} file`);
      expect(messageOf(error)).toMatch(/history/i);
      expect(readdirSync(dir).toSorted()).toEqual(
        ['.gitkeep', ...files].toSorted()
      );
    }
  );
});

describe('writeBaselineFile', () => {
  let root = '';

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'pgm-write-baseline-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('writes the migration', async () => {
    const path = join(root, '1789130096789_baseline.sql');
    const content =
      '-- Up Migration\nCREATE DOMAIN public."bıgınt" AS bigint;\n';

    await writeBaselineFile(path, content);

    expect(readFileSync(path, 'utf8')).toBe(content);
  });

  it('never overwrites a file', async () => {
    const path = join(root, '1789130096789_baseline.sql');
    writeFileSync(path, 'existing');

    await expect(writeBaselineFile(path, 'new')).rejects.toMatchObject({
      code: 'EEXIST',
    });
    expect(readFileSync(path, 'utf8')).toBe('existing');
  });
});
