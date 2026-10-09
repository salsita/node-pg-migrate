import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative } from 'node:path';
import type { ClientBase } from 'pg';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseline, BaselineError } from '../../src';
import { formatFakeCommand } from '../../src/baseline/core/fakeCommand';
import { renderHeader } from '../../src/baseline/core/header';
import { estimateRelations } from '../../src/baseline/core/locks';
import { sanitizeDump } from '../../src/baseline/core/sanitize';
import type { LogFn } from '../../src/logger';
import { generateDumpLike } from '../fixtures/generate';
import {
  adversarialPath,
  CAPTURED_DUMPS,
  DEFAULT_SANITIZE_OPTIONS,
  messageOf,
  rejectionOf,
} from './helpers';

/**
 * A logger that records what it is given.
 */
function recordingLogger(): {
  info: Mock<LogFn>;
  warn: Mock<LogFn>;
  error: Mock<LogFn>;
} {
  return { info: vi.fn<LogFn>(), warn: vi.fn<LogFn>(), error: vi.fn<LogFn>() };
}

/**
 * A client that records whether anything tried to use the database, and
 * fails if so.
 */
function untouchableClient(): { client: ClientBase; calls: string[] } {
  const calls: string[] = [];
  const refuse = (what: string) => (): Promise<never> => {
    calls.push(what);

    return Promise.reject(new Error(`the database must not be used (${what})`));
  };

  return {
    client: {
      query: refuse('query'),
      connect: refuse('connect'),
      end: refuse('end'),
    } as unknown as ClientBase,
    calls,
  };
}

const KITCHEN_SINK_18 = CAPTURED_DUMPS.find(
  (dump) => dump.name === 'pg18/kitchen-sink'
);

describe('baseline', () => {
  let root = '';

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'pgm-baseline-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  describe('options', () => {
    it('refuses an empty name before creating the directory', async () => {
      const dir = join(root, 'migrations');
      const error = await rejectionOf(
        baseline({
          dir,
          name: '',
          fromFile: adversarialPath('comment-on-extension.sql'),
          logger: recordingLogger(),
        })
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'INVALID_OPTIONS' });
      expect(existsSync(dir)).toBe(false);
    });

    it('refuses to run without a dump file or a connection', async () => {
      const dir = join(root, 'migrations');
      const error = await rejectionOf(
        baseline({ dir, logger: recordingLogger() })
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'INVALID_OPTIONS' });
      expect(existsSync(dir)).toBe(false);
    });

    it('refuses both databaseUrl and dbClient without using either', async () => {
      const dir = join(root, 'migrations');
      const { client, calls } = untouchableClient();
      const error = await rejectionOf(
        baseline({
          dir,
          fromFile: adversarialPath('comment-on-extension.sql'),
          databaseUrl: 'postgres://nobody:secret@127.0.0.1:1/nothing',
          dbClient: client,
          logger: recordingLogger(),
        })
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'INVALID_OPTIONS' });
      expect(calls).toEqual([]);
      expect(existsSync(dir)).toBe(false);
    });
  });

  describe('a migrations directory with files', () => {
    it('is refused before the dump is read or the database is used', async () => {
      const dir = join(root, 'migrations');
      mkdirSync(dir);
      writeFileSync(join(dir, '1700000000000_init.sql'), '-- Up Migration\n');
      const { client, calls } = untouchableClient();
      const error = await rejectionOf(
        baseline({
          dir,
          fromFile: join(root, 'no-such-dump.sql'),
          dbClient: client,
          logger: recordingLogger(),
        })
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'MIGRATIONS_EXIST' });
      expect(messageOf(error)).toContain(dir);
      expect(calls).toEqual([]);
      expect(readdirSync(dir)).toEqual(['1700000000000_init.sql']);
    });
  });

  describe('a dump file without a connection', () => {
    it('writes one migration made of the header and the cleaned-up dump, and says how to record it', async () => {
      if (KITCHEN_SINK_18 === undefined) {
        throw new Error('missing captured dump pg18/kitchen-sink');
      }

      const dir = join(root, 'db', 'migrations');
      const logger = recordingLogger();
      const result = await baseline({
        dir,
        fromFile: KITCHEN_SINK_18.path,
        logger,
      });
      const sanitized = sanitizeDump(
        KITCHEN_SINK_18.sql,
        DEFAULT_SANITIZE_OPTIONS
      );

      expect(result.migrationName).toMatch(/^\d{13}_baseline$/);
      expect(isAbsolute(result.path)).toBe(true);
      expect(result.path).toBe(join(dir, `${result.migrationName}.sql`));
      expect(readdirSync(dir)).toEqual([basename(result.path)]);
      expect(result.fakeCommand).toBe(
        formatFakeCommand(result.migrationName, dir)
      );
      expect(result.source).toEqual({
        serverVersion: '18.6',
        pgDumpVersion: '18.6',
        file: 'kitchen-sink.sql',
      });
      expect(result.relations).toBe(estimateRelations(sanitized.stats));
      expect(result.requiredMaxLocksPerTransaction).toBeUndefined();
      expect(result.warnings).toEqual([]);
      expect(readFileSync(result.path, 'utf8')).toBe(
        renderHeader({
          migrationName: result.migrationName,
          fakeCommand: result.fakeCommand,
          source: result.source,
          materializedViews: sanitized.stats.materializedViews,
          relations: result.relations,
        }) + sanitized.sql
      );
      expect(logger.info.mock.calls).toEqual([
        [`> Wrote ${relative(process.cwd(), result.path)}`],
        [
          '> On databases that already have this schema, record it without running it:',
        ],
        [`>   ${result.fakeCommand}`],
        ['> Blank databases run it with a normal `node-pg-migrate up`.'],
      ]);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('names the migration as asked', async () => {
      const result = await baseline({
        dir: join(root, 'migrations'),
        name: 'initial-schema',
        filenameFormat: 'index',
        fromFile: adversarialPath('comment-on-extension.sql'),
        logger: recordingLogger(),
      });

      expect(result.migrationName).toBe('0001_initial-schema');
      expect(basename(result.path)).toBe('0001_initial-schema.sql');
    });

    it('warns when blank databases need more locks than the default', async () => {
      const fromFile = join(root, 'dump.sql');
      writeFileSync(fromFile, generateDumpLike(700));
      const logger = recordingLogger();
      const result = await baseline({
        dir: join(root, 'migrations'),
        fromFile,
        logger,
      });

      expect(result.requiredMaxLocksPerTransaction).toBe(128);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('max_locks_per_transaction');
      expect(result.warnings[0]).toContain('128');
      expect(logger.warn).toHaveBeenCalledWith(
        `> Warning: ${result.warnings[0] ?? ''}`
      );
      expect(readFileSync(result.path, 'utf8')).toContain(
        'max_locks_per_transaction = 128'
      );
    });

    it.each([
      {
        name: 'the first of several schemas',
        options: { schema: ['app', 'other'] },
      },
      { name: 'a single schema', options: { schema: 'app' } },
      { name: 'the migrations schema', options: { migrationsSchema: 'app' } },
      {
        name: 'the migrations table',
        options: { migrationsTable: 'PgMigrations' },
      },
    ])(
      'looks for the migrations table in $name, and writes nothing when the dump creates it',
      async ({ options }) => {
        const dir = join(root, 'migrations');
        const error = await rejectionOf(
          baseline({
            ...options,
            dir,
            fromFile: adversarialPath('migrations-table-lookalike.sql'),
            logger: recordingLogger(),
          })
        );

        expect(error).toBeInstanceOf(BaselineError);
        expect(error).toMatchObject({ code: 'MIGRATIONS_TABLE_IN_DUMP' });
        // A refused baseline writes nothing, not even the directory.
        expect(existsSync(dir)).toBe(false);
      }
    );

    it('looks for public.pgmigrations by default, and the migrations schema wins over the schemas', async () => {
      const fromFile = adversarialPath('migrations-table-lookalike.sql');

      await expect(
        baseline({
          dir: join(root, 'default'),
          fromFile,
          logger: recordingLogger(),
        })
      ).resolves.toMatchObject({
        migrationName: expect.stringMatching(/_baseline$/),
      });
      await expect(
        baseline({
          dir: join(root, 'explicit'),
          fromFile,
          schema: ['app'],
          migrationsSchema: 'public',
          logger: recordingLogger(),
        })
      ).resolves.toMatchObject({
        migrationName: expect.stringMatching(/_baseline$/),
      });
    });

    it('writes nothing when the dump is not a baseline', async () => {
      const dir = join(root, 'migrations');
      const error = await rejectionOf(
        baseline({
          dir,
          fromFile: adversarialPath('psql-connect.sql'),
          logger: recordingLogger(),
        })
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'PSQL_META_COMMAND' });
      // A refused baseline writes nothing, not even the directory.
      expect(existsSync(dir)).toBe(false);
    });

    it.each([
      { file: 'insert-data.sql', code: 'DATA_IN_DUMP' },
      { file: 'begin-in-atomic-body-with-data.sql', code: 'DATA_IN_DUMP' },
      {
        file: 'standard-conforming-strings-off.sql',
        code: 'NON_STANDARD_STRINGS',
      },
      { file: 'latin1-encoding.sql', code: 'NOT_UTF8' },
      { file: 'set-session-authorization.sql', code: 'SET_ROLE_IN_DUMP' },
      { file: 'set-role.sql', code: 'SET_ROLE_IN_DUMP' },
    ])('writes nothing for the dump $file ($code)', async ({ file, code }) => {
      const dir = join(root, 'migrations');
      const error = await rejectionOf(
        baseline({
          dir,
          fromFile: adversarialPath(file),
          logger: recordingLogger(),
        })
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code });
      expect(existsSync(dir) ? readdirSync(dir) : []).toEqual([]);
    });
  });
});
