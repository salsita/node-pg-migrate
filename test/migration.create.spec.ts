import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
