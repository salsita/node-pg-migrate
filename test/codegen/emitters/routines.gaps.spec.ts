import { describe, expect, it } from 'vitest';
import { emitAggregate } from '../../../src/codegen/emitters/aggregates';
import { emitFunction } from '../../../src/codegen/emitters/functions';
import { emitOperator } from '../../../src/codegen/emitters/operators';
import type { Routine } from '../../../src/introspect/types';
import {
  makeAggregate,
  makeFunction,
  makeOperator,
} from '../../introspect/objects';
import {
  expectCode,
  expectFallback,
  expectSql,
  expectSqlOneOf,
} from '../expectations';
import { emitAndRun } from '../run';

// Functions, aggregates and operators beyond the frozen specs: native
// functions (CONTRACT-TS.md §11), settings, and operator names.

describe('emitFunction', () => {
  it.each<[string, string, Partial<Omit<Routine, 'kind'>>]>([
    [
      'a C function',
      'language c',
      {
        language: 'c',
        cost: 1,
        definition:
          "CREATE OR REPLACE FUNCTION kitchen.f(integer)\n RETURNS integer\n LANGUAGE c\n IMMUTABLE STRICT\nAS '$libdir/kitchen', $function$kitchen_f$function$\n",
      },
    ],
    [
      'an internal function',
      'language internal',
      {
        language: 'internal',
        cost: 1,
        definition:
          'CREATE OR REPLACE FUNCTION kitchen.f(integer, integer)\n RETURNS integer\n LANGUAGE internal\n IMMUTABLE STRICT\nAS $function$int4pl$function$\n',
      },
    ],
    [
      'a C function with a cost that is not its default',
      'cost or rows, language c',
      {
        language: 'c',
        cost: 100,
        definition:
          "CREATE OR REPLACE FUNCTION kitchen.f()\n RETURNS integer\n LANGUAGE c\n COST 100\nAS '$libdir/kitchen', $function$kitchen_f$function$\n",
      },
    ],
    [
      'a C function with a planner support function and a cost that is not its default',
      'cost or rows, support function, language c',
      {
        language: 'c',
        cost: 10,
        support: 'kitchen.f_support',
        definition:
          "CREATE OR REPLACE FUNCTION kitchen.f()\n RETURNS integer\n LANGUAGE c\n COST 10 SUPPORT kitchen.f_support\nAS '$libdir/kitchen', $function$kitchen_f$function$\n",
      },
    ],
  ])(
    'falls back to pg_get_functiondef for %s, whose body is a symbol',
    (_, reason, fields) => {
      const routine = makeFunction('kitchen', 'f', fields);
      const result = emitAndRun(emitFunction, routine);

      expectFallback(result, ...reason.split(', '));
      expect(result.calls).toStrictEqual(['sql']);
      expectSql(result, routine.definition);
    }
  );

  it.each<[string, string, string]>([
    [
      'a list setting with quoted names',
      String.raw`"$user", public, "My ""Schema"""`,
      `SET "search_path" TO '$user', 'public', 'My "Schema"'`,
    ],
    [
      'a malformed list setting',
      '"unterminated, public',
      `SET "search_path" TO '"unterminated, public'`,
    ],
    [
      'a list setting with text after a quoted name',
      '"a" b',
      `SET "search_path" TO '"a" b'`,
    ],
    [
      'a list setting with an empty element',
      'public, , pg_temp',
      `SET "search_path" TO 'public, , pg_temp'`,
    ],
    ['an empty list setting', '  ', `SET "search_path" TO ''`],
  ])('writes %s as string constants', (_, value, expected) => {
    const result = emitAndRun(
      emitFunction,
      makeFunction('kitchen', 'f', {
        config: [{ name: 'search_path', value }],
      })
    );

    expectCode(result);
    expectSql(
      result,
      `CREATE FUNCTION "kitchen"."f"() RETURNS integer AS $$ SELECT 1 $$ VOLATILE LANGUAGE sql ${expected};`
    );
  });

  it('writes a setting with a backslash as an escape string constant', () => {
    const result = emitAndRun(
      emitFunction,
      makeFunction('kitchen', 'f', {
        config: [{ name: 'TEMP_TABLESPACES', value: String.raw`a\b, c` }],
      })
    );

    expect(result.steps[0]).toContain(String.raw`TO E'a\\b', 'c'`);
  });

  it('writes the type alone for an unnamed argument without a default, and a function without a result as void', () => {
    const { returns: _returns, ...routine } = makeFunction('kitchen', 'f', {
      arguments: [
        { mode: 'IN', type: 'integer' },
        { mode: 'VARIADIC', type: 'text[]' },
      ],
    });
    const result = emitAndRun(emitFunction, routine);

    expectCode(result);
    expect(result.emitted.code).toContain(
      `['integer', { mode: 'VARIADIC', type: 'text[]' }]`
    );
    expectSql(
      result,
      'CREATE FUNCTION "kitchen"."f"(integer, VARIADIC text[]) RETURNS void AS $$ SELECT 1 $$ VOLATILE LANGUAGE sql;'
    );
  });
});

describe('emitAggregate', () => {
  it('writes the moving settings that are set, and leaves out the defaults', () => {
    const result = emitAndRun(
      emitAggregate,
      makeAggregate('kitchen', 'sum_plus', {
        identityArguments: 'VARIADIC numeric[]',
        argumentTypes: ['numeric[]'],
        stateFunction: 'kitchen.sum_step',
        stateType: 'numeric',
        moving: {
          stateFunction: 'kitchen.sum_step',
          inverseFunction: 'kitchen.sum_unstep',
          stateType: 'numeric',
          finalFunctionExtra: false,
          finalFunctionModify: 'READ_ONLY',
        },
        parallel: 'RESTRICTED',
      })
    );

    expectFallback(result, 'aggregate');
    expectSql(
      result,
      `CREATE AGGREGATE "kitchen"."sum_plus"(VARIADIC numeric[]) (
         SFUNC = kitchen.sum_step,
         STYPE = numeric,
         MSFUNC = kitchen.sum_step,
         MINVFUNC = kitchen.sum_unstep,
         MSTYPE = numeric,
         PARALLEL = RESTRICTED
       );`
    );
  });
});

describe('emitOperator', () => {
  it('writes a symbol that looks like an expression without parentheses', () => {
    const result = emitAndRun(
      emitOperator,
      makeOperator('public', '@>', {
        left: { schema: 'public', name: 'box2' },
        right: { schema: 'public', name: 'box2' },
        function: { schema: 'public', name: 'box2_contains' },
        commutator: { schema: 'public', name: '<@' },
        negator: { schema: 'public', name: '!@>' },
        restrict: { schema: 'pg_catalog', name: 'contsel' },
        join: { schema: 'pg_catalog', name: 'contjoinsel' },
      })
    );

    expectCode(result);
    expect(result.emitted.code).toContain(`pgm.createOperator({ name: '@>' }`);
    expectSql(
      result,
      `CREATE OPERATOR @> (
         FUNCTION = box2_contains,
         LEFTARG = box2,
         RIGHTARG = box2,
         COMMUTATOR = <@,
         NEGATOR = !@>,
         RESTRICT = pg_catalog.contsel,
         JOIN = pg_catalog.contjoinsel
       );`
    );
  });

  it('falls back to CREATE OPERATOR when its schema is a keyword', () => {
    const result = emitAndRun(
      emitOperator,
      makeOperator('user', '===', {
        function: { schema: 'user', name: 'eq' },
        negator: { schema: 'user', name: '!==' },
        restrict: { schema: 'pg_catalog', name: 'eqsel' },
        join: { schema: 'pg_catalog', name: 'eqjoinsel' },
        hashes: true,
        merges: true,
      })
    );

    expectFallback(result, 'operator schema', 'commutator or negator');
    expectSql(
      result,
      `CREATE OPERATOR "user".=== (
         FUNCTION = "user".eq,
         LEFTARG = pg_catalog.int4,
         RIGHTARG = pg_catalog.int4,
         NEGATOR = OPERATOR("user".!==),
         RESTRICT = pg_catalog.eqsel,
         JOIN = pg_catalog.eqjoinsel,
         HASHES,
         MERGES
       );`
    );
  });

  it('falls back to CREATE OPERATOR for a prefix operator whose negator is in another schema', () => {
    const { left: _left, ...prefix } = makeOperator('public', '~~~', {
      function: { schema: 'public', name: 'flip' },
      negator: { schema: 'kitchen', name: '!~~~' },
    });
    const result = emitAndRun(emitOperator, prefix);

    expectFallback(result, 'commutator or negator');
    expectSqlOneOf(result, [
      'CREATE OPERATOR public.~~~ (FUNCTION = public.flip, RIGHTARG = pg_catalog.int4, NEGATOR = OPERATOR(kitchen.!~~~));',
    ]);
  });
});
