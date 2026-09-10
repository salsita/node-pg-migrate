import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveConfig } from '../../src/cli/config';

const { jitiImport } = vi.hoisted(() => ({ jitiImport: vi.fn() }));

// The CLI loads the library by its package name; only the config file loader is needed here.
vi.mock('node-pg-migrate', () => ({ jiti: { import: jitiImport } }));
vi.mock('config', () => ({ default: { has: () => false } }));

describe('cli', () => {
  describe('resolveConfig', () => {
    beforeEach(() => {
      jitiImport.mockReset();
    });

    it('should fall back to the public schema, marked as a default', async () => {
      await expect(resolveConfig({})).resolves.toMatchObject({
        schema: ['public'],
        schemaIsDefault: true,
      });
    });

    it('should not mark a schema given on the command line as a default', async () => {
      await expect(
        resolveConfig({ schema: ['public'] })
      ).resolves.toMatchObject({ schema: ['public'], schemaIsDefault: false });
    });

    it('should not mark a schema from a config file as a default', async () => {
      jitiImport.mockResolvedValue({ schema: 'app' });

      await expect(
        resolveConfig({ configFile: 'migrations.config.js' })
      ).resolves.toMatchObject({ schema: 'app', schemaIsDefault: false });
    });
  });
});
