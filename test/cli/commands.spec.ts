import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runMigration } from '../../src/cli/commands';

const { runnerMock } = vi.hoisted(() => ({
  runnerMock: vi.fn(() => Promise.resolve([])),
}));

// The CLI loads the library by its package name: stand in for the runner it drives.
vi.mock('node-pg-migrate', () => ({
  jiti: { import: vi.fn() },
  Migration: {},
  runner: runnerMock,
}));
vi.mock('config', () => ({ default: { has: () => false } }));

describe('cli', () => {
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
