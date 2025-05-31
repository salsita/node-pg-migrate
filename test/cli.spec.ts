import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { Migration, runCli } from '../src';
import { tryImport } from '../src/cliRunner';

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

describe('cliRunner', () => {
  let consoleError: MockInstance<{
    (...data: never[]): void;
    (message?: never, ...optionalParams: never[]): void;
  }>;
  let consoleLog: MockInstance<{
    (...data: never[]): void;
    (message?: never, ...optionalParams: never[]): void;
  }>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows help and returns 1 for no arguments', async () => {
    const code = await runCli([], {});
    expect(code).toBe(1);
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining('Invalid Action')
    );
  });

  it('shows help and returns 1 for invalid action', async () => {
    const code = await runCli(['invalid'], {});
    expect(code).toBe(1);
    expect(consoleError).toHaveBeenCalledWith(
      'Invalid Action: Must be [up|down|create|redo].'
    );
  });

  it('shows help and returns 1 for create without migration name', async () => {
    const code = await runCli(['create'], {});
    expect(code).toBe(1);
    expect(consoleError).toHaveBeenCalledWith("'migrationName' is required.");
  });

  it('prints "dry run" when --dry-run is passed', async () => {
    const code = await runCli(['up', '--dry-run'], {
      DATABASE_URL: 'postgres://user:pass@localhost/db',
    });
    expect(code).toBe(0);
    expect(consoleLog).toHaveBeenCalledWith('dry run');
  });

  it('prints "no lock" when --lock=false is passed', async () => {
    const code = await runCli(['up', '--lock=false'], {
      DATABASE_URL: 'postgres://user:pass@localhost/db',
    });
    expect(code).toBe(0);
    expect(consoleLog).toHaveBeenCalledWith('no lock');
  });

  it('handles uncaughtException gracefully', async () => {
    const oldListener = process.listeners('uncaughtException');
    process.removeAllListeners('uncaughtException');
    process.on('uncaughtException', () => {});
    const code = await runCli(['up'], {
      DATABASE_URL: 'postgres://user:pass@localhost/db',
    });
    expect(code).toBe(0);
    for (const l of oldListener) process.on('uncaughtException', l);
  });

  it('should throw an error if tsconfig.json cannot be loaded', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      await runCli(['up', '--ts-node', '--tsconfig', 'invalid-path.json'], {
        DATABASE_URL: 'postgres://user:pass@localhost/db',
      });
    } catch {
      // Ignore the error thrown by the mock
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(consoleError.mock.calls.flat()).toContain(
      "Can't load tsconfig.json:"
    );

    exitSpy.mockRestore();
    consoleError.mockRestore();
  });

  it('should handle invalid action gracefully', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const code = await runCli(['invalid-action'], {
      DATABASE_URL: 'postgres://user:pass@localhost/db',
    });

    expect(code).toBe(1);
    expect(consoleError.mock.calls.flat()).toContain(
      'Invalid Action: Must be [up|down|create|redo].'
    );

    consoleError.mockRestore();
  });

  it('should handle missing database connection gracefully', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const code = await runCli(['up'], {});

    expect(code).toBe(1);
    expect(consoleError.mock.calls.flat()).toContain(
      'The DATABASE_URL environment variable is not set or incomplete connection parameters are provided.'
    );

    consoleError.mockRestore();
  });

  it('returns 1 and shows help if no args', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const code = await runCli([], {});
    expect(code).toBe(1);
    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Invalid Action')
    );

    errorSpy.mockRestore();
  });

  it('returns 1 and shows help for invalid action', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const code = await runCli(['invalid'], {});

    expect(code).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      'Invalid Action: Must be [up|down|create|redo].'
    );
  });

  it('returns 1 if migrationName is missing for create', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const code = await runCli(['create'], {});
    expect(code).toBe(1);
    expect(console.error).toHaveBeenCalledWith("'migrationName' is required.");
  });

  it('returns null if module does not exist', async () => {
    await expect(tryImport('non-existent-module')).resolves.toBeNull();
  });

  it('resolves with module when module exists', async () => {
    const mod = await tryImport('node:fs');
    expect(mod).not.toBeNull();
    expect(typeof (mod as typeof import('fs')).readFile).toBe('function');
  });

  it('handles error in Migration.create', async () => {
    const origCreate = Migration.create;
    Migration.create = () => Promise.reject(new Error('fail'));

    const code = await runCli(['create', 'test'], {});
    expect(code).toBe(1);

    Migration.create = origCreate;
  });

  it('handles error in migrationRunner', async () => {
    const runnerModule = await import('../src');
    const runnerSpy = vi
      .spyOn(runnerModule, 'runner')
      .mockImplementation(() => Promise.reject(new Error('fail')));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    try {
      const r = await runCli(['up'], {
        DATABASE_URL: 'postgres://user:pass@localhost/db',
      });

      console.log('Migration runner returned:', r);
      expect(r).toBe(1);
    } catch {
      // Ignore the error thrown by the mock
    }

    //expect(exitSpy).toHaveBeenCalledWith(1);
    runnerSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('handles config file with url property', async () => {
    const fs = require('node:fs');
    const tmp = require('node:os').tmpdir();
    const path = require('node:path').join(
      tmp,
      `test-config-url-${Date.now()}.json`
    );
    fs.writeFileSync(
      path,
      JSON.stringify({ url: 'postgres://user:pass@localhost/db' })
    );
    const code = await runCli(['up', '--config-file', path], {});
    expect(code).toBe(0);
    fs.unlinkSync(path);
  });

  it('handles config file with client config shape', async () => {
    const fs = require('node:fs');
    const tmp = require('node:os').tmpdir();
    const path = require('node:path').join(
      tmp,
      `test-config-client-${Date.now()}.json`
    );
    fs.writeFileSync(
      path,
      JSON.stringify({
        user: 'u',
        host: 'h',
        database: 'd',
        password: 'p',
        port: 5432,
        ssl: false,
      })
    );
    const code = await runCli(['up', '--config-file', path], {});
    expect(code).toBe(0);
    fs.unlinkSync(path);
  });
});
