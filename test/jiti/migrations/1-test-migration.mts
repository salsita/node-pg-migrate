import type { ColumnDefinitions, MigrationBuilder } from '../../../dist/bundle';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('t1', {
    id: 'id',
    string: { type: 'text', notNull: true },
    created: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('t1');
}
