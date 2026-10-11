import { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import type { CliOptions } from '../../src/cli/options';
import { addRunnerOptions } from '../../src/cli/options';

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
