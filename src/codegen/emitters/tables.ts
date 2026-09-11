import type { Table } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.createTable(name, columns, { comment, partition, inherits, unlogged
 * })`, with the table's and its columns' comments. Columns have `type`,
 * `notNull`, `default: pgm.func(…)`, `sequenceGenerated`,
 * `expressionGenerated`, `collation` and `comment`; an inheritance child
 * only lists its local columns. A column is `serial` / `bigserial` /
 * `smallserial` (and its `ownedSequence` is not emitted on its own) when it
 * is `NOT NULL`, its type is `integer` / `bigint` / `smallint`, its default
 * is `nextval('<ownedSequence>'::regclass)`, and the owned sequence is named
 * `<table>_<column>_seq` in the table's schema, has the column's type and
 * default options, and is logged like the table.
 *
 * The WHOLE table becomes one fallback, `CREATE TABLE …` built from the
 * model (columns in order, comments included), when it is a partition
 * (`CREATE TABLE … PARTITION OF … FOR VALUES …`), reason `'partition'`; has a
 * virtual generated column, `'virtual generated column'`; storage parameters,
 * `'storage parameters'`; a non-heap access method, `'access method'`;
 * several parents, `'multiple inheritance'`; an identity sequence that is not
 * named `<table>_<column>_seq`, `'identity sequence name'`; a `NOT NULL`
 * constraint whose name is not the default, `'NOT NULL constraint name'`;
 * column statistics, storage, compression or options, `'column settings'`;
 * or a `REPLICA IDENTITY` of `FULL` or `NOTHING`, `'replica identity'`. With
 * several reasons, they are joined with `', '`.
 *
 * @param table The table.
 * @param ctx The migration context.
 */
export function emitTable(_table: Table, _ctx: EmitContext): Emitted {
  throw new Error('not implemented');
}
