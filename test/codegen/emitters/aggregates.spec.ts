import { describe, expect, it } from 'vitest';
import { emitAggregate } from '../../../src/codegen/emitters/aggregates';
import { makeAggregate } from '../../introspect/objects';
import { expectFallback, expectSql } from '../expectations';
import { emitAndRun } from '../run';

describe('emitAggregate', () => {
  it('creates a simple aggregate with CREATE AGGREGATE', () => {
    const result = emitAndRun(
      emitAggregate,
      makeAggregate('kitchen', 'pipe_agg', {
        stateFunction: 'kitchen.pipe_concat',
        comment: 'Set by a comment step',
      })
    );

    expectFallback(result, 'aggregate');
    expect(result.calls).toStrictEqual(['sql']);
    expectSql(
      result,
      'CREATE AGGREGATE "kitchen"."pipe_agg"(text) (SFUNC = kitchen.pipe_concat, STYPE = text);'
    );
  });

  it('writes every setting of an aggregate, the moving ones included', () => {
    const result = emitAndRun(
      emitAggregate,
      makeAggregate('kitchen', 'avg_plus', {
        identityArguments: 'numeric',
        argumentTypes: ['numeric'],
        stateFunction: 'kitchen.avg_step',
        stateType: 'numeric[]',
        stateSpace: 64,
        finalFunction: 'kitchen.avg_final',
        finalFunctionExtra: true,
        finalFunctionModify: 'SHAREABLE',
        combineFunction: 'kitchen.avg_combine',
        serialFunction: 'kitchen.avg_serial',
        deserialFunction: 'kitchen.avg_deserial',
        initialCondition: '{0,0}',
        moving: {
          stateFunction: 'kitchen.avg_step',
          inverseFunction: 'kitchen.avg_unstep',
          stateType: 'numeric[]',
          stateSpace: 32,
          finalFunction: 'kitchen.avg_final',
          finalFunctionExtra: true,
          finalFunctionModify: 'READ_WRITE',
          initialCondition: "{0,1} it's",
        },
        sortOperator: 'OPERATOR(pg_catalog.<)',
        parallel: 'SAFE',
      })
    );

    expectFallback(result, 'aggregate');
    expectSql(
      result,
      `CREATE AGGREGATE "kitchen"."avg_plus"(numeric) (
         SFUNC = kitchen.avg_step,
         STYPE = numeric[],
         SSPACE = 64,
         FINALFUNC = kitchen.avg_final,
         FINALFUNC_EXTRA,
         FINALFUNC_MODIFY = SHAREABLE,
         COMBINEFUNC = kitchen.avg_combine,
         SERIALFUNC = kitchen.avg_serial,
         DESERIALFUNC = kitchen.avg_deserial,
         INITCOND = '{0,0}',
         MSFUNC = kitchen.avg_step,
         MINVFUNC = kitchen.avg_unstep,
         MSTYPE = numeric[],
         MSSPACE = 32,
         MFINALFUNC = kitchen.avg_final,
         MFINALFUNC_EXTRA,
         MFINALFUNC_MODIFY = READ_WRITE,
         MINITCOND = '{0,1} it''s',
         SORTOP = OPERATOR(pg_catalog.<),
         PARALLEL = SAFE
       );`
    );
  });

  it('writes (*) for an aggregate without arguments', () => {
    const result = emitAndRun(
      emitAggregate,
      makeAggregate('kitchen', 'count_all', {
        identityArguments: '',
        argumentTypes: [],
        stateFunction: 'kitchen.count_step',
        stateType: 'bigint',
        initialCondition: '0',
      })
    );

    expectFallback(result, 'aggregate');
    expectSql(
      result,
      `CREATE AGGREGATE "kitchen"."count_all"(*) (SFUNC = kitchen.count_step, STYPE = bigint, INITCOND = '0');`
    );
  });
});
