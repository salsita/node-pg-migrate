import type { ColumnDefinitions, MigrationBuilder } from '../../../dist';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('t3', {
    id: 'id',
    string: { type: 'text', notNull: true },
    created: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('t1', 'created', {
    method: 'brin',
    storageParameters: { pages_per_range: 32, autosummarize: true },
  });
  pgm.addIndex('t3', 'created', { method: 'brin' });
}
