import type { MigrationOptions } from '../src/migrationOptions';
import { createSchemalize } from '../src/utils';

export const options1: MigrationOptions = {
  typeShorthands: {},
  schemalize: createSchemalize({ shouldDecamelize: false, shouldQuote: false }),
  literal: createSchemalize({ shouldDecamelize: false, shouldQuote: true }),
  logger: console,
};

export const options2: MigrationOptions = {
  typeShorthands: {},
  schemalize: createSchemalize({ shouldDecamelize: true, shouldQuote: false }),
  literal: createSchemalize({ shouldDecamelize: true, shouldQuote: true }),
  logger: console,
};
