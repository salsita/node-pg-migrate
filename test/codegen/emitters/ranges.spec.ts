import { describe, expect, it } from 'vitest';
import { emitRange } from '../../../src/codegen/emitters/ranges';
import { makeRange } from '../../introspect/objects';
import { expectFallback, expectSql } from '../expectations';
import { emitAndRun } from '../run';

describe('emitRange', () => {
  it('creates a range type with CREATE TYPE, leaving out the default multirange name', () => {
    const result = emitAndRun(
      emitRange,
      makeRange('kitchen', 'float_range', 'double precision', {
        subtypeDiff: 'pg_catalog.float8mi',
        multirange: { schema: 'kitchen', name: 'float_multirange' },
        comment: 'Set by a comment step',
      })
    );

    expectFallback(result, 'range type');
    expect(result.calls).toStrictEqual(['sql']);
    expectSql(
      result,
      'CREATE TYPE "kitchen"."float_range" AS RANGE (subtype = double precision, subtype_diff = pg_catalog.float8mi);'
    );
  });

  it('leaves out the default multirange name of a range whose name has no "range"', () => {
    const result = emitAndRun(
      emitRange,
      makeRange('kitchen', 'timespan', 'timestamp with time zone', {
        multirange: { schema: 'kitchen', name: 'timespan_multirange' },
      })
    );

    expectFallback(result, 'range type');
    expectSql(
      result,
      'CREATE TYPE "kitchen"."timespan" AS RANGE (subtype = timestamp with time zone);'
    );
  });

  it('writes every setting that is not the default', () => {
    const result = emitAndRun(
      emitRange,
      makeRange('kitchen', 'text_span', 'text', {
        subtypeOpclass: 'pg_catalog.text_pattern_ops',
        collation: 'pg_catalog."C"',
        canonical: 'kitchen.text_span_canonical',
        subtypeDiff: 'kitchen.text_span_diff',
        multirange: { schema: 'kitchen', name: 'spans' },
      })
    );

    expectFallback(result, 'range type');
    expectSql(
      result,
      `CREATE TYPE "kitchen"."text_span" AS RANGE (
         subtype = text,
         subtype_opclass = pg_catalog.text_pattern_ops,
         collation = pg_catalog."C",
         canonical = kitchen.text_span_canonical,
         subtype_diff = kitchen.text_span_diff,
         multirange_type_name = kitchen.spans
       );`
    );
  });
});
