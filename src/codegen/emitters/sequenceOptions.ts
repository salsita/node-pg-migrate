// The options of a sequence that have to be written, shared by standalone
// sequences (`createSequence`) and identity columns (`sequenceGenerated`).

import type { SequenceOptions } from '../../introspect/types';
import type { Code } from '../code';
import { num, raw, str } from '../code';

const TYPE_BOUNDS: Readonly<Record<string, readonly [bigint, bigint]>> = {
  smallint: [-32_768n, 32_767n],
  integer: [-2_147_483_648n, 2_147_483_647n],
  bigint: [-9_223_372_036_854_775_808n, 9_223_372_036_854_775_807n],
};

const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * The options of a sequence that are not the defaults PostgreSQL would give
 * it, so the ones to write.
 */
export interface WrittenSequenceOptions {
  /**
   * `AS <type>`, when the type is not the default one.
   */
  readonly type?: string;
  readonly increment?: bigint;
  readonly minValue?: bigint;
  readonly maxValue?: bigint;
  readonly start?: bigint;
  readonly cache?: bigint;
  readonly cycle: boolean;
}

/**
 * The options of a sequence to write: the ones that differ from what
 * PostgreSQL chooses when they are left out. The bounds default to `1` and
 * the largest value of the type for an ascending sequence, the smallest
 * value of the type and `-1` for a descending one; `START` defaults to the
 * minimum of an ascending sequence and the maximum of a descending one.
 *
 * @param options The options, as the catalog stores them.
 * @param defaultType The type a sequence gets without `AS`: `bigint` for
 * `CREATE SEQUENCE`, the column's type for an identity column.
 */
export function writtenSequenceOptions(
  options: SequenceOptions,
  defaultType: string
): WrittenSequenceOptions {
  const [typeMin, typeMax] = TYPE_BOUNDS[options.type] ?? TYPE_BOUNDS.bigint;
  const increment = BigInt(options.increment);
  const ascending = increment > 0n;
  const minValue = BigInt(options.minValue);
  const maxValue = BigInt(options.maxValue);
  const start = BigInt(options.start);
  const cache = BigInt(options.cache);
  const differs = (value: bigint, byDefault: bigint): bigint | undefined =>
    value === byDefault ? undefined : value;

  return {
    type: options.type === defaultType ? undefined : options.type,
    increment: differs(increment, 1n),
    minValue: differs(minValue, ascending ? 1n : typeMin),
    maxValue: differs(maxValue, ascending ? typeMax : -1n),
    start: differs(start, ascending ? minValue : maxValue),
    cache: differs(cache, 1n),
    cycle: options.cycle,
  };
}

/**
 * The numbers among written options.
 */
function numbers(written: WrittenSequenceOptions): bigint[] {
  return [
    written.increment,
    written.minValue,
    written.maxValue,
    written.start,
    written.cache,
  ].filter((value) => value !== undefined);
}

/**
 * Whether a written option is beyond `Number.MAX_SAFE_INTEGER` (either way),
 * which a JavaScript number cannot hold exactly.
 *
 * @param written The options to write.
 */
export function hasUnsafeNumber(written: WrittenSequenceOptions): boolean {
  return numbers(written).some(
    (value) => value > MAX_SAFE_INTEGER || value < -MAX_SAFE_INTEGER
  );
}

/**
 * Whether a written option is `0`, which the sequence options of the `pgm`
 * operations leave out (they skip falsy values), so the sequence would get
 * the default instead.
 *
 * @param written The options to write.
 */
export function hasZero(written: WrittenSequenceOptions): boolean {
  return numbers(written).includes(0n);
}

/**
 * The written options as SQL clauses, in the order `CREATE SEQUENCE` lists
 * them, e.g. `['AS integer', 'INCREMENT BY 10', 'CYCLE']`.
 *
 * @param written The options to write.
 */
export function sequenceOptionsSql(written: WrittenSequenceOptions): string[] {
  const clauses: string[] = [];
  if (written.type !== undefined) {
    clauses.push(`AS ${written.type}`);
  }

  if (written.increment !== undefined) {
    clauses.push(`INCREMENT BY ${written.increment.toString()}`);
  }

  if (written.minValue !== undefined) {
    clauses.push(`MINVALUE ${written.minValue.toString()}`);
  }

  if (written.maxValue !== undefined) {
    clauses.push(`MAXVALUE ${written.maxValue.toString()}`);
  }

  if (written.start !== undefined) {
    clauses.push(`START WITH ${written.start.toString()}`);
  }

  if (written.cache !== undefined) {
    clauses.push(`CACHE ${written.cache.toString()}`);
  }

  if (written.cycle) {
    clauses.push('CYCLE');
  }

  return clauses;
}

function numberCode(value: bigint | undefined): Code | undefined {
  return value === undefined ? undefined : num(Number(value));
}

/**
 * The written options as the properties of `SequenceOptions` (`type`,
 * `increment`, `minvalue`, `maxvalue`, `start`, `cache`, `cycle`). Only for
 * options without unsafe numbers or zeros (see {@link hasUnsafeNumber} and
 * {@link hasZero}).
 *
 * @param written The options to write.
 */
export function sequenceOptionsCode(
  written: WrittenSequenceOptions
): Array<readonly [string, Code | undefined]> {
  return [
    ['type', written.type === undefined ? undefined : str(written.type)],
    ['increment', numberCode(written.increment)],
    ['minvalue', numberCode(written.minValue)],
    ['maxvalue', numberCode(written.maxValue)],
    ['start', numberCode(written.start)],
    ['cache', numberCode(written.cache)],
    ['cycle', written.cycle ? raw('true') : undefined],
  ];
}
