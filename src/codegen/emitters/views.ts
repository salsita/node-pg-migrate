import type { View } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.createView(name, { checkOption, options }, definition)`, then
 * `pgm.alterViewColumn(name, column, { default: pgm.func(…) })` for each
 * column with a default.
 *
 * Fallback (`CREATE VIEW … AS <definition>` built from the model) when an
 * option is one `ViewOptions` cannot express, reason `'view options'`.
 *
 * @param view The view.
 * @param ctx The migration context.
 */
export function emitView(_view: View, _ctx: EmitContext): Emitted {
  throw new Error('not implemented');
}
