import {
  appendFile,
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Migration } from '../src/migration';

describe('Migration.create', () => {
  let directory: string;
  let migrationsDirectory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'pgm create '));
    migrationsDirectory = join(directory, 'new migrations');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it.each(['js', 'ts', 'sql', 'cjs', 'mjs', 'cts', 'mts'] as const)(
    'copies the complete bundled %s template',
    async (language) => {
      const filename = await Migration.create('example', migrationsDirectory, {
        filenameFormat: 'index',
        language,
      });

      expect(filename).toBe(
        join(migrationsDirectory, `0001_example.${language}`)
      );
      expect(await readFile(filename)).toEqual(
        await readFile(
          new URL(
            `../templates/migration-template.${language}`,
            import.meta.url
          )
        )
      );
    }
  );

  it('finishes copying a custom template before resolving', async () => {
    const templateFileName = join(directory, 'custom template.sql');
    const content = '-- custom template\nSELECT 1;\n'.repeat(8192);
    await writeFile(templateFileName, content);

    const filename = await Migration.create('example', migrationsDirectory, {
      templateFileName,
    });

    expect(await readFile(filename, 'utf8')).toBe(content);
  });

  describe.skipIf(process.platform === 'win32')(
    'destination permissions',
    () => {
      it.each([
        {
          name: 'creates an editable migration from a read-only template',
          templateMode: 0o444,
          mask: 0o022,
          expectedMode: 0o644,
        },
        {
          name: 'respects a restrictive umask for a new migration',
          templateMode: 0o644,
          mask: 0o077,
          expectedMode: 0o600,
        },
      ])('$name', async ({ templateMode, mask, expectedMode }) => {
        const templateFileName = join(directory, 'custom template.sql');
        const content = '-- custom template\n';
        await writeFile(templateFileName, content);
        await chmod(templateFileName, templateMode);

        const previousMask = process.umask(mask);
        try {
          const filename = await Migration.create(
            'example',
            migrationsDirectory,
            { templateFileName }
          );

          expect((await stat(filename)).mode & 0o777).toBe(expectedMode);
          await appendFile(filename, 'SELECT 1;\n');
          expect(await readFile(filename, 'utf8')).toBe(
            `${content}SELECT 1;\n`
          );
        } finally {
          process.umask(previousMask);
        }
      });

      it('preserves the existing destination mode when overwriting', async () => {
        const templateFileName = join(directory, 'custom template.sql');
        const content = '-- replacement template\n';
        await writeFile(templateFileName, content);
        await chmod(templateFileName, 0o444);
        await mkdir(migrationsDirectory);
        const filename = join(migrationsDirectory, '1700000000000_example.sql');
        await writeFile(filename, '-- original contents that are longer\n');
        await chmod(filename, 0o600);

        const now = vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
        try {
          expect(
            await Migration.create('example', migrationsDirectory, {
              templateFileName,
            })
          ).toBe(filename);
          expect((await stat(filename)).mode & 0o777).toBe(0o600);
          expect(await readFile(filename, 'utf8')).toBe(content);
        } finally {
          now.mockRestore();
        }
      });
    }
  );

  it('rejects a missing template without creating an empty migration', async () => {
    const templateFileName = join(directory, 'missing.sql');

    await expect(
      Migration.create('example', migrationsDirectory, { templateFileName })
    ).rejects.toMatchObject({ code: 'ENOENT' });

    expect(await readdir(migrationsDirectory)).toEqual([]);
  });

  it('rejects a directory template without creating an empty migration', async () => {
    const templateFileName = join(directory, 'directory.sql');
    await mkdir(templateFileName);

    await expect(
      Migration.create('example', migrationsDirectory, { templateFileName })
    ).rejects.toThrow();

    expect(await readdir(migrationsDirectory)).toEqual([]);
  });

  it('rejects a destination that cannot be written', async () => {
    const filename = join(migrationsDirectory, '0001_example.sql');
    await mkdir(filename, { recursive: true });

    await expect(
      Migration.create('example', migrationsDirectory, {
        filenameFormat: 'index',
        language: 'sql',
      })
    ).rejects.toThrow();

    expect(await readdir(migrationsDirectory)).toEqual(['0001_example.sql']);
  });
});
