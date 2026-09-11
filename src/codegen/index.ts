import type { SchemaModel } from '../introspect/types';
import type { GeneratedMigration, GenerateOptions } from './types';

export type {
  Emitted,
  EmitContext,
  Fallback,
  GeneratedMigration,
  GenerateOptions,
  OutputLanguage,
  RenderOptions,
} from './types';

/**
 * Generates a TypeScript or JavaScript baseline migration made of `pgm`
 * calls from the model of a schema.
 *
 * Orders the steps (`orderObjects()`), emits each one with the emitter of
 * its kind (a `serial` column's sequence and its ownership are part of the
 * table, so they are not emitted on their own), and renders the file
 * (`renderMigration()`); `stats` counts what the migration creates, and sizes
 * the header's `max_locks_per_transaction` note.
 *
 * Throws a `BaselineError` with code `UNSUPPORTED_OBJECTS` when the model has
 * objects that no migration can represent (`model.unsupported`, suggesting
 * `--format sql`), when the dependencies have a cycle, or, with `strict`,
 * when any object needs a fallback; the message lists every such object and
 * why.
 *
 * @param model The schema.
 * @param options The language, the default schema and what the header says.
 * @returns The migration, its fallbacks and what it creates.
 */
export function generateMigration(
  _model: SchemaModel,
  _options: GenerateOptions
): GeneratedMigration {
  throw new Error('not implemented');
}
