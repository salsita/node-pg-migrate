import { describe, expect, it, vi } from 'vitest';

// Mock ts-node to simulate not installed
vi.mock('ts-node', () => ({
  get default() {
    throw Object.assign(new Error('not found'), {
      code: 'ERR_MODULE_NOT_FOUND',
    });
  },
}));

// Mock tsx/esm to simulate not installed
vi.mock('tsx/esm', () => ({
  get default() {
    throw Object.assign(new Error('not found'), {
      code: 'ERR_MODULE_NOT_FOUND',
    });
  },
}));

// Mock pg to prevent real DB connections
vi.mock('pg', () => {
  const mockPg = {
    Client: class {
      connect = vi.fn().mockResolvedValue(null);
      end = vi.fn().mockResolvedValue(null);
      query = vi.fn().mockResolvedValue({ rows: [] });
    },
  };
  return {
    ...mockPg,
    default: mockPg,
  };
});

import { runCli } from '../src';

describe('cliRunner (ts-node missing)', () => {
  it('returns 1 if ts-node is required but not installed', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      await runCli(['up', '--ts-node', '--tsconfig', 'tsconfig.json'], {
        DATABASE_URL: 'postgres://user:pass@localhost/db',
      });
    } catch {
      // Ignore the error thrown by the mock
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(consoleError.mock.calls.flat()).toContain(
      "For TypeScript support, please install 'ts-node' module"
    );

    exitSpy.mockRestore();
    consoleError.mockRestore();
  });
  it('returns 0 and logs error if tsx is required but not installed', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const code = await runCli(['up', '--tsx'], {
      DATABASE_URL: 'postgres://user:pass@localhost/db',
    });

    expect(code).toBe(0);
    expect(consoleError.mock.calls.flat()).toContain(
      "For TSX support, please install 'tsx' module"
    );

    consoleError.mockRestore();
  });
});
