import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MigrationStatus } from '../../src';
import { runMigration, runStatus } from '../../src/cli/commands';

const { runnerMock, statusMock } = vi.hoisted(() => ({
  runnerMock: vi.fn(() => Promise.resolve([])),
  statusMock: vi.fn(() => Promise.resolve<MigrationStatus[]>([])),
}));

// The CLI loads the library by its package name: stand in for the runner it drives.
vi.mock('node-pg-migrate', () => ({
  jiti: { import: vi.fn() },
  Migration: {},
  runner: runnerMock,
  getMigrationStatus: statusMock,
}));
vi.mock('config', () => ({ default: { has: () => false } }));

describe('cli', () => {
  describe('runStatus', () => {
    const originalExitCode = process.exitCode;

    beforeEach(() => {
      vi.stubEnv('DATABASE_URL', 'postgres://localhost:5432/db');
      vi.spyOn(console, 'log').mockImplementation(() => {});
      process.exitCode = undefined;
    });

    afterEach(() => {
      statusMock.mockReset();
      runnerMock.mockClear();
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
      process.exitCode = originalExitCode;
    });

    it('prints each status and uses the configured source, history and TLS options', async () => {
      statusMock.mockResolvedValueOnce([
        {
          name: '001_first',
          status: 'applied',
          runOn: new Date('2026-10-14T12:00:00.000Z'),
        },
        { name: '002_removed', status: 'missing' },
        { name: '003_next', status: 'pending' },
      ]);
      await runStatus({
        databaseUrlVar: 'DATABASE_URL',
        migrationsDir: 'custom/*.ts',
        useGlob: true,
        ignorePattern: '**/ignored*',
        schema: ['app'],
        migrationsSchema: 'meta',
        migrationsTable: 'history',
        rejectUnauthorized: false,
        tsconfigPaths: 'true',
      });
      expect(statusMock).toHaveBeenCalledWith(
        expect.objectContaining({
          databaseUrl: {
            connectionString: 'postgres://localhost:5432/db',
            ssl: { rejectUnauthorized: false },
          },
          dir: 'custom/*.ts',
          useGlob: true,
          ignorePattern: '**/ignored*',
          schema: ['app'],
          schemaIsDefault: false,
          migrationsSchema: 'meta',
          migrationsTable: 'history',
          tsconfigPaths: true,
        })
      );
      expect(console.log).toHaveBeenCalledWith('Status\tMigration\tRun on');
      expect(console.log).toHaveBeenCalledWith(
        'applied\t001_first\t2026-10-14T12:00:00.000Z'
      );
      expect(console.log).toHaveBeenCalledWith('missing\t002_removed\t');
      expect(console.log).toHaveBeenCalledWith('pending\t003_next\t');
      expect(process.exitCode).toBe(0);
      expect(runnerMock).not.toHaveBeenCalled();
    });

    it('prints a JSON array with ISO dates and no table output', async () => {
      const migrations: MigrationStatus[] = [
        {
          name: '001_removed',
          status: 'missing',
          runOn: new Date('2026-10-14T12:00:00.000Z'),
        },
        { name: '002_next', status: 'pending' },
      ];
      statusMock.mockResolvedValueOnce(migrations);
      await runStatus({ databaseUrlVar: 'DATABASE_URL', json: true });
      expect(console.log).toHaveBeenCalledExactlyOnceWith(
        JSON.stringify(migrations)
      );
      expect(process.exitCode).toBe(0);
    });

    it.each([
      { statuses: [], expected: 0 },
      { statuses: ['applied'], expected: 0 },
      { statuses: ['pending'], expected: 1 },
      { statuses: ['missing'], expected: 1 },
      { statuses: ['applied', 'pending', 'missing'], expected: 1 },
    ] as const)(
      'sets the opt-in exit code for $statuses',
      async ({ statuses, expected }) => {
        statusMock.mockResolvedValueOnce(
          statuses.map((status, index) => ({ name: String(index), status }))
        );
        await runStatus({ databaseUrlVar: 'DATABASE_URL', exitCode: true });
        expect(process.exitCode).toBe(expected);
      }
    );

    it('prints an empty JSON array for an empty source and history', async () => {
      await runStatus({ databaseUrlVar: 'DATABASE_URL', json: true });
      expect(console.log).toHaveBeenCalledExactlyOnceWith('[]');
    });

    it('preserves the status exit code and JSON output with --force-exit', async () => {
      const exit = vi
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);
      const migrations: MigrationStatus[] = [
        { name: '001_next', status: 'pending' },
      ];
      statusMock.mockResolvedValueOnce(migrations);
      await runStatus({
        databaseUrlVar: 'DATABASE_URL',
        json: true,
        exitCode: true,
        forceExit: true,
      });
      expect(exit).toHaveBeenCalledWith(1);
      expect(console.log).toHaveBeenCalledExactlyOnceWith(
        JSON.stringify(migrations)
      );
    });

    it('reports an empty history and source', async () => {
      await runStatus({ databaseUrlVar: 'DATABASE_URL' });
      expect(console.log).toHaveBeenCalledWith('No migrations found.');
      expect(statusMock).toHaveBeenCalledWith(
        expect.objectContaining({ schemaIsDefault: true })
      );
    });

    it('propagates errors to the CLI error handler without printing a result', async () => {
      statusMock.mockRejectedValueOnce(new Error('permission denied'));
      await expect(
        runStatus({ databaseUrlVar: 'DATABASE_URL' })
      ).rejects.toThrow('permission denied');
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('runMigration', () => {
    beforeEach(() => {
      vi.stubEnv('DATABASE_URL', 'postgres://localhost:5432/db');
      vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      runnerMock.mockClear();
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it('should tell the runner that the public schema is only a default', async () => {
      await runMigration('up', [], { databaseUrlVar: 'DATABASE_URL' });

      await vi.waitFor(() => {
        expect(runnerMock).toHaveBeenCalledWith(
          expect.objectContaining({ schema: ['public'], schemaIsDefault: true })
        );
      });
    });

    it('should tell the runner that a schema given with --schema was chosen', async () => {
      await runMigration('up', [], {
        databaseUrlVar: 'DATABASE_URL',
        schema: ['tenant_a'],
      });

      await vi.waitFor(() => {
        expect(runnerMock).toHaveBeenCalledWith(
          expect.objectContaining({
            schema: ['tenant_a'],
            schemaIsDefault: false,
          })
        );
      });
    });

    describe('redo', () => {
      it.each([
        { given: {} },
        { given: { schema: ['app', 'public'] } },
        {
          given: { schema: ['app'], migrationsSchema: 'meta' },
        },
        { given: { createMigrationsSchema: true } },
      ])(
        'should delegate both phases to one runner call for %j',
        async ({ given }) => {
          await runMigration('redo', [], {
            databaseUrlVar: 'DATABASE_URL',
            ...given,
          });

          await vi.waitFor(() => {
            expect(runnerMock).toHaveBeenCalledTimes(1);
          });
          expect(runnerMock).toHaveBeenCalledWith(
            expect.objectContaining({
              direction: 'redo',
              createMigrationsSchema: given.createMigrationsSchema,
              migrationsSchema: given.migrationsSchema,
              schema: given.schema ?? ['public'],
            })
          );
        }
      );

      it.each([
        {
          positional: ['2'],
          options: {},
          expected: { count: 2, timestamp: undefined, file: undefined },
        },
        {
          positional: ['1234567890'],
          options: { timestamp: true },
          expected: { count: 1234567890, timestamp: true, file: undefined },
        },
        {
          positional: ['001_selected'],
          options: {},
          expected: {
            count: undefined,
            timestamp: undefined,
            file: '001_selected',
          },
        },
      ])(
        'should pass selection and transaction options to redo for %j',
        async ({ positional, options, expected }) => {
          await runMigration('redo', positional, {
            databaseUrlVar: 'DATABASE_URL',
            singleTransaction: true,
            fake: true,
            dryRun: true,
            lock: true,
            lockValue: 42,
            ...options,
          });

          await vi.waitFor(() => {
            expect(runnerMock).toHaveBeenCalledTimes(1);
          });
          expect(runnerMock).toHaveBeenCalledWith(
            expect.objectContaining({
              direction: 'redo',
              singleTransaction: true,
              fake: true,
              dryRun: true,
              noLock: false,
              lockValue: 42,
              ...expected,
            })
          );
        }
      );

      it('should not re-apply anything when the down run fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const exit = vi
          .spyOn(process, 'exit')
          .mockImplementation(() => undefined as never);
        runnerMock.mockRejectedValueOnce(new Error('down failed'));

        await runMigration('redo', [], { databaseUrlVar: 'DATABASE_URL' });

        await vi.waitFor(() => {
          expect(exit).toHaveBeenCalledWith(1);
        });
        expect(runnerMock).toHaveBeenCalledTimes(1);
      });
    });
  });
});
