import type { MigrationOptions } from '../src/types';
import { createSchemalize } from '../src/utils';

export const options1: MigrationOptions = {
  typeShorthands: {},
  schemalize: createSchemalize(false, false),
  literal: createSchemalize(false, true),
  logger: console,
};

export const options2: MigrationOptions = {
  typeShorthands: {},
  schemalize: createSchemalize(true, false),
  literal: createSchemalize(true, true),
  logger: console,
};
