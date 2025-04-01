import type { Logger } from './logger';
import type { ColumnDefinitions } from './operations/tables';
import type { Literal } from './utils/createTransformer';

export interface MigrationOptions {
  typeShorthands?: ColumnDefinitions;

  schemalize: Literal;

  literal: Literal;

  logger: Logger;
}
