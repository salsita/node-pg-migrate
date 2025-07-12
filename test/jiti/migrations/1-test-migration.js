import { MigrationBuilder } from '../../../dist/bundle';

export const shorthands = undefined;

/**
 *
 * @param {MigrationBuilder} pgm
 */
export function up(pgm) {
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
