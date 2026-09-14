import { describe, expect, it } from 'vitest';
import { emitCast } from '../../../src/codegen/emitters/casts';
import type { Cast } from '../../../src/introspect/types';
import { makeCast } from '../../introspect/objects';
import { expectCode, expectSql } from '../expectations';
import { emitAndRun } from '../run';

describe('emitCast', () => {
  it.each<[string, Cast, string]>([
    [
      'a cast with a function of another schema',
      makeCast('character varying', 'integer', {
        method: 'function',
        function: { schema: 'kitchen', name: 'varchar_to_int' },
        functionArguments: ['character varying'],
        context: 'ASSIGNMENT',
        comment: 'Set by a comment step',
      }),
      'CREATE CAST (character varying AS integer) WITH FUNCTION "kitchen"."varchar_to_int"(character varying) AS ASSIGNMENT;',
    ],
    [
      'a cast with a function of the default schema and several arguments',
      makeCast('numeric', 'kitchen.money', {
        method: 'function',
        function: { schema: 'public', name: 'to_money' },
        functionArguments: ['numeric', 'integer', 'boolean'],
      }),
      'CREATE CAST (numeric AS kitchen.money) WITH FUNCTION "to_money"(numeric, integer, boolean);',
    ],
    [
      'an implicit cast through the input and output functions',
      makeCast('kitchen.mood', 'text', {
        method: 'inout',
        context: 'IMPLICIT',
      }),
      'CREATE CAST (kitchen.mood AS text) WITH INOUT AS IMPLICIT;',
    ],
    [
      'a binary-coercible cast',
      makeCast('kitchen.bytes', 'bytea'),
      'CREATE CAST (kitchen.bytes AS bytea) WITHOUT FUNCTION;',
    ],
  ])('creates %s with pgm.createCast', (_, cast, expected) => {
    const result = emitAndRun(emitCast, cast);

    expectCode(result);
    expect(result.calls).toStrictEqual(['createCast']);
    expectSql(result, expected);
  });
});
