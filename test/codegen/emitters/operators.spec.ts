import { describe, expect, it } from 'vitest';
import { emitOperator } from '../../../src/codegen/emitters/operators';
import { makeOperator } from '../../introspect/objects';
import { expectCode, expectFallback, expectSql } from '../expectations';
import { emitAndRun } from '../run';

const NUMERIC = { schema: 'pg_catalog', name: 'numeric' };

describe('emitOperator', () => {
  it('creates an operator of the default schema with pgm.createOperator', () => {
    const result = emitAndRun(
      emitOperator,
      makeOperator('public', '=~=', {
        left: NUMERIC,
        right: NUMERIC,
        function: { schema: 'kitchen', name: 'roughly_equal' },
        commutator: { schema: 'public', name: '=~=' },
        negator: { schema: 'public', name: '!~=' },
        restrict: { schema: 'pg_catalog', name: 'eqsel' },
        join: { schema: 'pg_catalog', name: 'eqjoinsel' },
        hashes: true,
        identityArguments: 'numeric, numeric',
        comment: 'Set by a comment step',
      })
    );

    expectCode(result);
    expect(result.calls).toStrictEqual(['createOperator']);
    expectSql(
      result,
      `CREATE OPERATOR =~= (
         FUNCTION = kitchen.roughly_equal,
         LEFTARG = pg_catalog.numeric,
         RIGHTARG = pg_catalog.numeric,
         COMMUTATOR = =~=,
         NEGATOR = !~=,
         RESTRICT = pg_catalog.eqsel,
         JOIN = pg_catalog.eqjoinsel,
         HASHES
       );`
    );
  });

  it('creates a prefix operator in a schema whose name needs no quotes', () => {
    const { left: _left, ...prefix } = makeOperator('kitchen', '<~>', {
      right: { schema: 'pg_catalog', name: 'int4' },
      function: { schema: 'kitchen', name: 'negate' },
      merges: true,
      identityArguments: 'NONE, integer',
    });
    const result = emitAndRun(emitOperator, prefix);

    expectCode(result);
    expectSql(
      result,
      'CREATE OPERATOR kitchen.<~> (FUNCTION = kitchen.negate, RIGHTARG = pg_catalog.int4, MERGES);'
    );
  });

  it('falls back to CREATE OPERATOR when the schema needs quotes', () => {
    const result = emitAndRun(
      emitOperator,
      makeOperator('Sink Área', '=~=', {
        left: NUMERIC,
        right: NUMERIC,
        function: { schema: 'Sink Área', name: 'roughly_equal' },
      })
    );

    expectFallback(result, 'operator schema');
    expect(result.calls).toStrictEqual(['sql']);
    expectSql(
      result,
      'CREATE OPERATOR "Sink Área".=~= (FUNCTION = "Sink Área".roughly_equal, LEFTARG = pg_catalog.numeric, RIGHTARG = pg_catalog.numeric);'
    );
  });

  it('falls back to CREATE OPERATOR when the commutator or negator is in another schema', () => {
    const result = emitAndRun(
      emitOperator,
      makeOperator('kitchen', '=~=', {
        left: NUMERIC,
        right: NUMERIC,
        function: { schema: 'kitchen', name: 'roughly_equal' },
        commutator: { schema: 'kitchen', name: '=~=' },
        negator: { schema: 'kitchen', name: '!~=' },
      })
    );

    expectFallback(result, 'commutator or negator');
    expect(result.calls).toStrictEqual(['sql']);
    expectSql(
      result,
      `CREATE OPERATOR kitchen.=~= (
         FUNCTION = kitchen.roughly_equal,
         LEFTARG = pg_catalog.numeric,
         RIGHTARG = pg_catalog.numeric,
         COMMUTATOR = OPERATOR(kitchen.=~=),
         NEGATOR = OPERATOR(kitchen.!~=)
       );`
    );
  });
});
