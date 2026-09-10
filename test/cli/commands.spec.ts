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
  });
});
