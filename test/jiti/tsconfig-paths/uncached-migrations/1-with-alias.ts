import { columns, tableName } from '@helpers/columns';
import type { ColumnDefinitions, MigrationBuilder } from '../../../../dist';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.createTable(tableName, columns);
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable(tableName);
}
