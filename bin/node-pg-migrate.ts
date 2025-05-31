#!/usr/bin/env node

import { runCli } from 'node-pg-migrate';

runCli(process.argv.slice(2), process.env)
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
