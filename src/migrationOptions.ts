import type { Logger } from './logger';
import type { ColumnDefinitions } from './operations/tables';
import type { Literal } from './utils/createTransformer';

export interface MigrationOptions {
  typeShorthands?: ColumnDefinitions;

  schemalize: Literal;

  literal: Literal;

  logger: Logger;

  /**
   * Format the generated SQL statements with linebreaks and indentation for
   * better readability. When `false`, each statement is emitted as a single
   * line.
   *
   * @default false
   */
  pretty: boolean;
}
