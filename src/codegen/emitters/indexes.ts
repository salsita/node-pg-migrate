import type { Index } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.createIndex(table, columns, { name, unique, where, include, method,
 * nulls })` for an index whose keys are columns or expressions without an
 * operator class or collation, each `ASC` or `DESC` with its default nulls
 * order, and whose method is one `CreateIndexOptions.method` allows
 * (`btree`, `hash`, `gist`, `spgist`, `gin`).
 *
 * Anything else is a fallback (`pg_get_indexdef`, `definition`), reason
 * `'index method <method>'`, `'operator class'`, `'collation'`, `'nulls
 * order'` or `'storage parameters'`; so is an index the table is clustered
 * on or uses as its replica identity (the index is created, then `ALTER
 * TABLE … CLUSTER ON …` / `REPLICA IDENTITY USING INDEX …`), reason `'CLUSTER
 * ON'` / `'replica identity'`. With several reasons, they are joined with
 * `', '`.
 *
 * @param index The index.
 * @param ctx The migration context.
 */
export function emitIndex(_index: Index, _ctx: EmitContext): Emitted {
  throw new Error('not implemented');
}
