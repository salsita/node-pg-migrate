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
        { given: {}, pinned: 'public' },
        { given: { schema: ['app', 'public'] }, pinned: 'app' },
        {
          given: { schema: ['app'], migrationsSchema: 'meta' },
          pinned: 'meta',
        },
        { given: { createMigrationsSchema: true }, pinned: 'public' },
      ])(
        'should re-apply into the migrations table the down run used ($pinned)',
        async ({ given, pinned }) => {
          await runMigration('redo', [], {
            databaseUrlVar: 'DATABASE_URL',
            ...given,
          });

          await vi.waitFor(() => {
            expect(runnerMock).toHaveBeenCalledTimes(2);
          });
          expect(runnerMock).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
              direction: 'down',
              createMigrationsSchema: given.createMigrationsSchema,
            })
          );
          // Reverting can leave that table empty; pinned, the up run does not go looking
          // for a history in another schema and refuse halfway through the redo. Nor does
          // it create the schema the down run has just used, which needs more privileges.
          expect(runnerMock).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
              direction: 'up',
              migrationsSchema: pinned,
              createMigrationsSchema: false,
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
