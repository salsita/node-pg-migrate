import { describe, expect, it } from 'vitest';
import { emitComposite } from '../../../src/codegen/emitters/composites';
import { makeComposite } from '../../introspect/objects';
import { expectCode, expectFallback, expectSql } from '../expectations';
import { emitAndRun } from '../run';

describe('emitComposite', () => {
  it('creates a composite type with its attributes in order with pgm.createType', () => {
    const result = emitAndRun(
      emitComposite,
      makeComposite('public', 'postal_address', [
        { name: 'street', type: 'text', comment: 'Set by a comment step' },
        { name: 'postal_code', type: 'character varying(12)' },
        { name: 'Country Code', type: 'character(2)' },
        { name: 'mood', type: 'kitchen.mood' },
      ])
    );

    expectCode(result);
    expect(result.calls).toStrictEqual(['createType']);
    expectSql(
      result,
      `CREATE TYPE "postal_address" AS ("street" text, "postal_code" character varying(12), "Country Code" character(2), "mood" kitchen.mood);`
    );
  });

  it('falls back to CREATE TYPE for an attribute with a collation', () => {
    const result = emitAndRun(
      emitComposite,
      makeComposite('kitchen', 'labels', [
        { name: 'name', type: 'text' },
        { name: 'code', type: 'text', collation: 'pg_catalog."C"' },
      ])
    );

    expectFallback(result, 'attribute collation');
    expect(result.calls).toStrictEqual(['sql']);
    expectSql(
      result,
      `CREATE TYPE "kitchen"."labels" AS ("name" text, "code" text COLLATE pg_catalog."C");`
    );
  });
});
