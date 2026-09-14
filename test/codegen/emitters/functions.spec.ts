import { describe, expect, it } from 'vitest';
import {
  emitFunction,
  usesCreateFunction,
} from '../../../src/codegen/emitters/functions';
import type { Routine } from '../../../src/introspect/types';
import { makeFunction } from '../../introspect/objects';
import {
  expectCode,
  expectFallback,
  expectSql,
  expectSqlOneOf,
} from '../expectations';
import { emitAndRun } from '../run';

const PLPGSQL_BODY = `
DECLARE
    label text := 'price; not the end of a statement $$ {name}';
BEGIN
    IF p_price IS NULL THEN
        RETURN 'unknown';
    END IF;
    RETURN label || E'\\n' || p_price::text;
END;
`;

describe('emitFunction', () => {
  it('creates a function with pgm.createFunction and keeps its body exactly', () => {
    const result = emitAndRun(
      emitFunction,
      makeFunction('kitchen', 'describe_price', {
        arguments: [{ mode: 'IN', name: 'p_price', type: 'numeric' }],
        identityArguments: 'p_price numeric',
        returns: 'text',
        language: 'plpgsql',
        body: PLPGSQL_BODY,
        volatility: 'IMMUTABLE',
        comment: 'Set by a comment step',
      })
    );

    expectCode(result);
    expect(result.calls).toStrictEqual(['createFunction']);
    expectSql(
      result,
      `CREATE FUNCTION "kitchen"."describe_price"("p_price" numeric) RETURNS text
       AS $fn$${PLPGSQL_BODY}$fn$ IMMUTABLE LANGUAGE plpgsql;`
    );
  });

  it('writes the modes, names and defaults of the arguments, defaults with pgm.func', () => {
    const result = emitAndRun(
      emitFunction,
      makeFunction('public', 'order_stats', {
        arguments: [
          { mode: 'IN', name: 'p_since', type: 'date' },
          { mode: 'INOUT', name: 'label', type: 'text' },
          { mode: 'OUT', name: 'total', type: 'numeric' },
          { mode: 'IN', type: 'integer', default: '30' },
        ],
        identityArguments: 'p_since date, INOUT label text, integer',
        returns: 'record',
        body: ' SELECT label, 1::numeric ',
      })
    );

    expectCode(result);
    expect(result.funcs).toStrictEqual(['30']);
    expectSql(
      result,
      `CREATE FUNCTION "order_stats"("p_since" date, INOUT "label" text, OUT "total" numeric, integer DEFAULT 30)
       RETURNS record AS $$ SELECT label, 1::numeric $$ VOLATILE LANGUAGE sql;`
    );
  });

  it('writes a VARIADIC argument and a set-returning result', () => {
    const result = emitAndRun(
      emitFunction,
      makeFunction('kitchen', 'split_parts', {
        arguments: [
          { mode: 'IN', name: 'sep', type: 'text' },
          { mode: 'VARIADIC', name: 'parts', type: 'text[]' },
        ],
        identityArguments: 'sep text, VARIADIC parts text[]',
        returns: 'TABLE(part text, position integer)',
        returnsSet: true,
        rows: 1000,
        volatility: 'STABLE',
        body: ' SELECT p, 1 FROM unnest(parts) AS p ',
      })
    );

    expectCode(result);
    expectSql(
      result,
      `CREATE FUNCTION "kitchen"."split_parts"("sep" text, VARIADIC "parts" text[])
       RETURNS TABLE(part text, position integer)
       AS $$ SELECT p, 1 FROM unnest(parts) AS p $$ STABLE LANGUAGE sql;`
    );
  });

  it('writes the security, strictness, parallel safety, window and settings of a function', () => {
    const result = emitAndRun(
      emitFunction,
      makeFunction('kitchen', 'current_tenant', {
        routineKind: 'window',
        volatility: 'STABLE',
        securityDefiner: true,
        strict: true,
        parallel: 'SAFE',
        config: [
          { name: 'work_mem', value: '64MB' },
          { name: 'search_path', value: '""' },
        ],
      })
    );

    expectCode(result);
    expectSql(
      result,
      `CREATE FUNCTION "kitchen"."current_tenant"() RETURNS integer AS $$ SELECT 1 $$
       STABLE LANGUAGE sql SECURITY DEFINER WINDOW RETURNS NULL ON NULL INPUT PARALLEL SAFE
       SET "work_mem" TO '64MB' SET "search_path" TO '';`
    );
  });

  it('writes a search_path list setting', () => {
    const result = emitAndRun(
      emitFunction,
      makeFunction('kitchen', 'safe_fn', {
        config: [{ name: 'search_path', value: 'pg_catalog, pg_temp' }],
      })
    );

    expectCode(result);
    expectSqlOneOf(result, [
      `CREATE FUNCTION "kitchen"."safe_fn"() RETURNS integer AS $$ SELECT 1 $$
       VOLATILE LANGUAGE sql SET "search_path" TO pg_catalog, pg_temp;`,
      `CREATE FUNCTION "kitchen"."safe_fn"() RETURNS integer AS $$ SELECT 1 $$
       VOLATILE LANGUAGE sql SET "search_path" TO 'pg_catalog', 'pg_temp';`,
    ]);
  });

  it.each<[string, Partial<Omit<Routine, 'kind'>>]>([
    ['a function with the default cost', { cost: 100 }],
    [
      'a set-returning function with the default rows',
      { returnsSet: true, rows: 1000, returns: 'SETOF integer' },
    ],
  ])('keeps %s idiomatic', (_, fields) => {
    const result = emitAndRun(
      emitFunction,
      makeFunction('kitchen', 'f', fields)
    );

    expectCode(result);
  });

  it.each<[string, string, Partial<Omit<Routine, 'kind'>>]>([
    [
      'a procedure',
      'procedure',
      {
        routineKind: 'procedure',
        language: 'plpgsql',
        definition:
          'CREATE OR REPLACE PROCEDURE kitchen.f(IN p_before date)\n LANGUAGE plpgsql\nAS $procedure$\nBEGIN\n  DELETE FROM kitchen.orders WHERE placed_at < p_before;\nEND;\n$procedure$\n',
      },
    ],
    [
      'a SQL-standard body',
      'SQL-standard body',
      {
        hasSqlBody: true,
        definition:
          'CREATE OR REPLACE FUNCTION kitchen.f(p integer)\n RETURNS integer\n LANGUAGE sql\n IMMUTABLE\nBEGIN ATOMIC\n SELECT (p + 1);\n SELECT (p + 2);\nEND\n',
      },
    ],
    [
      'a leakproof function',
      'leakproof',
      {
        leakproof: true,
        definition:
          'CREATE OR REPLACE FUNCTION kitchen.f()\n RETURNS integer\n LANGUAGE sql\n LEAKPROOF\nAS $function$ SELECT 1 $function$\n',
      },
    ],
    [
      'a cost that is not the default',
      'cost or rows',
      {
        cost: 50,
        definition:
          'CREATE OR REPLACE FUNCTION kitchen.f()\n RETURNS integer\n LANGUAGE sql\n COST 50\nAS $function$ SELECT 1 $function$\n',
      },
    ],
    [
      'rows that are not the default',
      'cost or rows',
      {
        returnsSet: true,
        returns: 'SETOF integer',
        rows: 10,
        definition:
          'CREATE OR REPLACE FUNCTION kitchen.f()\n RETURNS SETOF integer\n LANGUAGE sql\n ROWS 10\nAS $function$ SELECT 1 $function$\n',
      },
    ],
    [
      'a planner support function',
      'support function',
      {
        arguments: [
          { mode: 'IN', type: 'text' },
          { mode: 'IN', type: 'text' },
        ],
        identityArguments: 'text, text',
        returns: 'boolean',
        volatility: 'IMMUTABLE',
        strict: true,
        body: ' SELECT $1 LIKE $2 ',
        support: 'pg_catalog.textlike_support',
        definition:
          'CREATE OR REPLACE FUNCTION kitchen.f(text, text)\n RETURNS boolean\n LANGUAGE sql\n IMMUTABLE STRICT SUPPORT pg_catalog.textlike_support\nAS $function$ SELECT $1 LIKE $2 $function$\n',
      },
    ],
  ])('falls back to pg_get_functiondef for %s', (_, reason, fields) => {
    const routine = makeFunction('kitchen', 'f', fields);
    const result = emitAndRun(emitFunction, routine);

    expectFallback(result, reason);
    expect(result.calls).toStrictEqual(['sql']);
    expectSql(result, routine.definition);
  });
});

describe('usesCreateFunction', () => {
  it('is true for a function that emitFunction creates with pgm.createFunction and its set option', () => {
    expect(
      usesCreateFunction(
        makeFunction('kitchen', 'f', {
          config: [{ name: 'TimeZone', value: 'UTC' }],
        })
      )
    ).toBe(true);
  });

  it('is false for a function with a planner support function, whose settings its definition sets', () => {
    expect(
      usesCreateFunction(
        makeFunction('kitchen', 'f', {
          support: 'pg_catalog.textlike_support',
          config: [{ name: 'TimeZone', value: 'UTC' }],
        })
      )
    ).toBe(false);
  });
});
