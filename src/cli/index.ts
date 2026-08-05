#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { runCreate, runMigration } from './commands';
import type { CliOptions } from './options';
import { addCreateOptions, addRunnerOptions } from './options';

process.on('uncaughtException', (err) => {
  console.error(err);
  process.exit(1);
});

// Resolve the version from package.json. The built CLI lives in bin/, so the
// package manifest is one directory up at runtime (both in this repo and once
// published, where bin/ sits next to package.json).
const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as { version: string };

const program = new Command();

program
  .name('node-pg-migrate')
  .description('PostgreSQL database migration management tool')
  .version(version, '-i, --version', 'Show version number')
  .showHelpAfterError();

// `create` — scaffold a new migration file.
addCreateOptions(
  program
    .command('create')
    .description('Create a new migration file')
    .argument(
      '[migrationName...]',
      'Name of the migration (dashes replace spaces and underscores)'
    )
).action((nameArgs: string[], options: CliOptions, command: Command) =>
  runCreate(nameArgs, options, command)
);

// `up` / `down` — run pending migrations in the given direction.
for (const direction of ['up', 'down'] as const) {
  addRunnerOptions(
    program
      .command(direction)
      .description(
        direction === 'up'
          ? 'Run up migrations (optionally limited to a count or up to a migration name)'
          : 'Run down migrations (optionally limited to a count or down to a migration name)'
      )
      .argument(
        '[countOrName...]',
        'Number of migrations to run or a migration name'
      )
  ).action((posArgs: string[], options: CliOptions) =>
    runMigration(direction, posArgs, options)
  );
}

// `redo` — run a down migration immediately followed by an up migration.
addRunnerOptions(
  program
    .command('redo')
    .description('Run down then up migrations (optionally limited to a count)')
    .argument('[count...]', 'Number of migrations to redo')
).action((posArgs: string[], options: CliOptions) =>
  runMigration('redo', posArgs, options)
);

// Preserve the previous behavior: invoking the CLI without a command prints the
// help to stderr and exits with a non-zero code.
if (process.argv.slice(2).length === 0) {
  program.help({ error: true });
}

program.parseAsync().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
