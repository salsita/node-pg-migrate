import { createJiti } from 'jiti';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInThisContext } from 'node:vm';
import { expect } from 'vitest';
import type {
  EmitContext,
  Emitted,
  OutputLanguage,
} from '../../src/codegen/types';
import { MigrationBuilder } from '../../src/migrationBuilder';
import { createDefaultMigrationLoader } from '../../src/migrationLoader';
import type { MigrationBuilderActions } from '../../src/sqlMigration';

const jiti = createJiti(import.meta.url);

const noop = (): void => {};

/**
 * A `MigrationBuilder` like the runner's, on a database that must not be
 * used: generated code only builds SQL.
 */
export function newBuilder(): MigrationBuilder {
  const noDatabase = (): Promise<never> =>
    Promise.reject(new Error('generated code must not query the database'));

  return new MigrationBuilder(
    { query: noDatabase, select: noDatabase },
    undefined,
    false,
    { info: noop, warn: noop, error: noop },
    false
  );
}

/**
 * What running generated code on a `MigrationBuilder` did.
 */
export interface Execution {
  /**
   * The SQL it produced (`getSqlSteps()`).
   */
  readonly steps: string[];

  /**
   * The `pgm` operations it called, in order (`pgm.func` left out).
   */
  readonly calls: string[];

  /**
   * The argument of each `pgm.func` call, in order.
   */
  readonly funcs: string[];
}

function recording(
  builder: MigrationBuilder,
  calls: string[],
  funcs: string[]
): MigrationBuilder {
  return new Proxy(builder, {
    get(target, property, receiver): unknown {
      const value: unknown = Reflect.get(target, property, receiver);
      if (typeof value !== 'function' || typeof property !== 'string') {
        return value;
      }

      return (...args: unknown[]): unknown => {
        if (property === 'func') {
          funcs.push(String(args[0]));
        } else {
          calls.push(property);
        }

        return Reflect.apply(value, target, args);
      };
    },
  });
}

/**
 * Runs the code of emitted steps (TypeScript is type-stripped first, the way
 * jiti loads migrations) on a new `MigrationBuilder`.
 */
export function execute(
  steps: Emitted | ReadonlyArray<Emitted>,
  language: OutputLanguage
): Execution {
  const calls: string[] = [];
  const funcs: string[] = [];
  const builder = newBuilder();
  const pgm = recording(builder, calls, funcs);
  const list: ReadonlyArray<Emitted> = Array.isArray(steps) ? steps : [steps];
  for (const step of list) {
    const source =
      language === 'ts'
        ? jiti.transform({ source: step.code, filename: 'step.ts', ts: true })
        : step.code;
    const compiled: unknown = runInThisContext(
      `(function (pgm) {\n${source}\n})`,
      { filename: `emitted-step.${language}` }
    );
    if (typeof compiled !== 'function') {
      throw new TypeError('the emitted code did not compile to a function');
    }

    Reflect.apply(compiled, undefined, [pgm]);
  }

  return { steps: builder.getSqlSteps(), calls, funcs };
}

/**
 * A step emitted for a TypeScript migration, with what running it did.
 */
export interface EmitResult extends Execution {
  readonly emitted: Emitted;
}

/**
 * Emits an object for a TypeScript and for a JavaScript migration, runs both
 * codes, checks that they do the same and returns what the TypeScript one
 * did.
 */
export function emitAndRun<T>(
  emit: (object: T, ctx: EmitContext) => Emitted,
  object: T,
  defaultSchema = 'public'
): EmitResult {
  const ts = emit(object, { defaultSchema, language: 'ts' });
  const js = emit(object, { defaultSchema, language: 'js' });
  const tsRun = execute(ts, 'ts');
  const jsRun = execute(js, 'js');
  expect({
    kind: js.kind,
    reason: 'reason' in js ? js.reason : undefined,
  }).toEqual({
    kind: ts.kind,
    reason: 'reason' in ts ? ts.reason : undefined,
  });
  expect(jsRun).toEqual(tsRun);

  return { emitted: ts, ...tsRun };
}

/**
 * Loads a generated migration file the way the runner does (the default
 * loader, jiti), from a new temporary directory.
 */
export async function loadMigration(
  content: string,
  language: OutputLanguage
): Promise<MigrationBuilderActions> {
  const dir = await mkdtemp(join(tmpdir(), 'pgm-codegen-'));
  try {
    const file = join(dir, `1700000000000_baseline.${language}`);
    await writeFile(file, content, 'utf8');
    const [unit] = await createDefaultMigrationLoader()([file]);

    return unit.actions;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Runs the `up` of a loaded migration on a new `MigrationBuilder` and returns
 * its SQL.
 */
export async function runUp(
  actions: MigrationBuilderActions
): Promise<string[]> {
  const { up } = actions;
  if (typeof up !== 'function') {
    throw new TypeError('the migration has no up function');
  }

  const builder = newBuilder();
  await up(builder);

  return builder.getSqlSteps();
}
