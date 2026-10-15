import { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import type { CliOptions } from '../../src/cli/options';
import { addRunnerOptions, addStatusOptions } from '../../src/cli/options';

describe('CLI SSL verification options', () => {
  it.each([
    { args: [], expected: undefined },
    { args: ['--reject-unauthorized'], expected: true },
    { args: ['--no-reject-unauthorized'], expected: false },
    {
      args: ['--reject-unauthorized', '--no-reject-unauthorized'],
      expected: false,
    },
    {
      args: ['--no-reject-unauthorized', '--reject-unauthorized'],
      expected: true,
    },
  ])('keeps the SSL verification choice for $args', ({ args, expected }) => {
    const command = addRunnerOptions(new Command()).exitOverride();
    command.configureOutput({ writeErr: () => {} });
    command.parse(args, { from: 'user' });
    expect(command.opts<CliOptions>().rejectUnauthorized).toBe(expected);
  });
});

describe('status options', () => {
  it('accepts JSON output and an opt-in status exit code', () => {
    const command = addStatusOptions(new Command()).exitOverride();
    command.configureOutput({ writeErr: () => {} });
    command.parse(['--json', '--exit-code'], { from: 'user' });
    expect(command.opts<CliOptions>()).toMatchObject({
      json: true,
      exitCode: true,
    });
  });

  it.each([
    '--fake',
    '--dry-run',
    '--create-schema',
    '--no-lock',
    '--no-single-transaction',
    '1',
  ])('rejects migration execution arguments: %s', (argument) => {
    const command = addStatusOptions(new Command()).exitOverride();
    command.configureOutput({ writeErr: () => {} });
    expect(() => command.parse([argument], { from: 'user' })).toThrow();
  });
});

describe('runner options', () => {
  it.each(['up', 'down', 'redo'])(
    'lists connection/source options first and config options last for %s',
    (name) => {
      const help = addRunnerOptions(new Command(name)).helpInformation();
      expect(help.indexOf('-d, --database-url-var')).toBeLessThan(
        help.indexOf('-m, --migrations-dir')
      );
      expect(help.indexOf('-s, --schema')).toBeLessThan(
        help.indexOf('--create-schema')
      );
      expect(help.indexOf('--migrations-schema')).toBeLessThan(
        help.indexOf('--create-migrations-schema')
      );
      expect(help.indexOf('--tsconfig-paths')).toBeLessThan(
        help.indexOf('--create-schema')
      );
      expect(help.indexOf('--advisory-lock-mode')).toBeLessThan(
        help.indexOf('-f, --config-file')
      );
    }
  );

  it.each(['--json', '--exit-code'])(
    'rejects the status-only option %s',
    (argument) => {
      const command = addRunnerOptions(new Command()).exitOverride();
      command.configureOutput({ writeErr: () => {} });
      expect(() => command.parse([argument], { from: 'user' })).toThrow();
    }
  );
});
