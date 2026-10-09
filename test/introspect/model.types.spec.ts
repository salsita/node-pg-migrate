import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PUBLIC_SCHEMA_COMMENT,
  rowsToModel,
} from '../../src/introspect/core/model';
import {
  aggregateRow,
  castRow,
  collationRow,
  columnRow,
  compositeRow,
  constraintRow,
  domainRow,
  emptyRows,
  enumRow,
  extensionRow,
  FACTS,
  functionRow,
  operatorRow,
  rangeRow,
  schemaRow,
  sequenceRow,
  shellTypeRow,
} from './rows';

describe('rowsToModel', () => {
  it('gives an empty model for a database without objects', () => {
    const model = rowsToModel(emptyRows(), FACTS);

    expect(model).toStrictEqual({
      schemas: [],
      extensions: [],
      enums: [],
      composites: [],
      domains: [],
      ranges: [],
      collations: [],
      sequences: [],
      functions: [],
      operators: [],
      casts: [],
      aggregates: [],
      tables: [],
      constraints: [],
      indexes: [],
      views: [],
      materializedViews: [],
      triggers: [],
      policies: [],
      rules: [],
      statistics: [],
      dependencies: [],
      unsupported: [],
    });
  });

  describe('schemas', () => {
    it('keeps the user schemas, with their comments', () => {
      const model = rowsToModel(
        emptyRows({
          schemas: [
            schemaRow(16_400, 'kitchen'),
            schemaRow(16_401, 'audit', 'Audit trail'),
          ],
        }),
        FACTS
      );

      expect(model.schemas).toStrictEqual([
        {
          kind: 'schema',
          oid: 16_401,
          schema: 'audit',
          name: 'audit',
          comment: 'Audit trail',
        },
        { kind: 'schema', oid: 16_400, schema: 'kitchen', name: 'kitchen' },
      ]);
    });

    it.each([
      ['no comment', null],
      ['the default comment', DEFAULT_PUBLIC_SCHEMA_COMMENT],
    ])('leaves public out when it has %s', (_, comment) => {
      const model = rowsToModel(
        emptyRows({ schemas: [schemaRow(2200, 'public', comment)] }),
        FACTS
      );

      expect(model.schemas).toStrictEqual([]);
    });

    it('keeps public when it has a comment of its own', () => {
      const model = rowsToModel(
        emptyRows({ schemas: [schemaRow(2200, 'public', 'Main schema')] }),
        FACTS
      );

      expect(model.schemas).toStrictEqual([
        {
          kind: 'schema',
          oid: 2200,
          schema: 'public',
          name: 'public',
          comment: 'Main schema',
        },
      ]);
    });
  });

  it('keeps extensions with their version', () => {
    const model = rowsToModel(
      emptyRows({
        extensions: [extensionRow(16_500, 'kitchen', 'pg_trgm', '1.6')],
      }),
      FACTS
    );

    expect(model.extensions).toStrictEqual([
      {
        kind: 'extension',
        oid: 16_500,
        schema: 'kitchen',
        name: 'pg_trgm',
        version: '1.6',
      },
    ]);
  });

  it('keeps the labels of an enum in their sort order', () => {
    const labels = ['sad', 'meh', 'ok', 'happy', 'ecstatic'];
    const model = rowsToModel(
      emptyRows({
        enums: [enumRow(16_600, 'kitchen', 'mood', labels, 'How it went')],
      }),
      FACTS
    );

    expect(model.enums).toStrictEqual([
      {
        kind: 'enum',
        oid: 16_600,
        schema: 'kitchen',
        name: 'mood',
        comment: 'How it went',
        labels,
      },
    ]);
  });

  it('keeps the shell types in scope with the enums, sorted with them by name', () => {
    const model = rowsToModel(
      emptyRows({
        enums: [enumRow(16_610, 'kitchen', 'mood', ['sad', 'happy'])],
        shellTypes: [
          shellTypeRow(16_611, 'kitchen', 'rational', 'Defined later'),
          shellTypeRow(16_612, 'kitchen', 'box'),
          shellTypeRow(16_613, 'audit', 'hidden'),
        ],
      }),
      { ...FACTS, excludeSchemas: ['audit'] }
    );

    expect(model.enums).toStrictEqual([
      { kind: 'shellType', oid: 16_612, schema: 'kitchen', name: 'box' },
      {
        kind: 'enum',
        oid: 16_610,
        schema: 'kitchen',
        name: 'mood',
        labels: ['sad', 'happy'],
      },
      {
        kind: 'shellType',
        oid: 16_611,
        schema: 'kitchen',
        name: 'rational',
        comment: 'Defined later',
      },
    ]);
  });

  it('gives a composite type its attributes in attnum order', () => {
    const model = rowsToModel(
      emptyRows({
        composites: [
          compositeRow(16_700, 16_699, 'kitchen', 'postal_address', 'Where'),
        ],
        columns: [
          columnRow(16_699, 3, 'postal_code', 'character varying(12)'),
          columnRow(16_699, 1, 'street', 'text', {
            comment: 'Street and number',
            attstorage: 'x',
            typstorage: 'x',
          }),
          columnRow(16_699, 4, 'code', 'text', {
            collation: 'pg_catalog."C"',
            attstorage: 'x',
            typstorage: 'x',
          }),
          columnRow(16_699, 2, 'city', 'text', {
            attstorage: 'x',
            typstorage: 'x',
          }),
        ],
      }),
      FACTS
    );

    expect(model.composites).toStrictEqual([
      {
        kind: 'composite',
        oid: 16_700,
        schema: 'kitchen',
        name: 'postal_address',
        comment: 'Where',
        attributes: [
          { name: 'street', type: 'text', comment: 'Street and number' },
          { name: 'city', type: 'text' },
          { name: 'postal_code', type: 'character varying(12)' },
          { name: 'code', type: 'text', collation: 'pg_catalog."C"' },
        ],
      },
    ]);
  });

  describe('domains', () => {
    it('gives a domain its CHECK constraints sorted by name and its NOT NULL constraint name', () => {
      const model = rowsToModel(
        emptyRows({
          domains: [
            domainRow(16_800, 'kitchen', 'money_amount', {
              baseType: 'numeric(12,2)',
              notNull: true,
              default: '0',
              comment: 'Money',
            }),
          ],
          constraints: [
            constraintRow(
              16_801,
              'kitchen',
              'money_amount_not_negative',
              0,
              'c',
              'CHECK ((VALUE >= (0)::numeric))',
              {
                typid: 16_800,
                checkExpression: '(VALUE >= (0)::numeric)',
                comment: 'No debts',
              }
            ),
            constraintRow(
              16_803,
              'kitchen',
              'money_amount_not_null',
              0,
              'n',
              'NOT NULL',
              {
                typid: 16_800,
              }
            ),
            constraintRow(
              16_802,
              'kitchen',
              'money_amount_a_limit',
              0,
              'c',
              'CHECK ((VALUE < (1000000)::numeric)) NOT VALID',
              {
                typid: 16_800,
                checkExpression: '(VALUE < (1000000)::numeric)',
                convalidated: false,
              }
            ),
          ],
        }),
        FACTS
      );

      expect(model.domains).toStrictEqual([
        {
          kind: 'domain',
          oid: 16_800,
          schema: 'kitchen',
          name: 'money_amount',
          comment: 'Money',
          baseType: 'numeric(12,2)',
          notNull: true,
          notNullConstraintName: 'money_amount_not_null',
          default: '0',
          checks: [
            {
              name: 'money_amount_a_limit',
              expression: '(VALUE < (1000000)::numeric)',
              validated: false,
            },
            {
              name: 'money_amount_not_negative',
              expression: '(VALUE >= (0)::numeric)',
              validated: true,
              comment: 'No debts',
            },
          ],
        },
      ]);
      expect(model.constraints).toStrictEqual([]);
    });

    it('leaves out what a plain domain does not have', () => {
      const model = rowsToModel(
        emptyRows({
          domains: [
            domainRow(16_810, 'kitchen', 'email_address', {
              baseType: 'text',
              collation: 'pg_catalog."C"',
            }),
          ],
        }),
        FACTS
      );

      expect(model.domains).toStrictEqual([
        {
          kind: 'domain',
          oid: 16_810,
          schema: 'kitchen',
          name: 'email_address',
          baseType: 'text',
          notNull: false,
          collation: 'pg_catalog."C"',
          checks: [],
        },
      ]);
    });
  });

  it('keeps the settings of range types that are set', () => {
    const model = rowsToModel(
      emptyRows({
        ranges: [
          rangeRow(16_900, 'kitchen', 'float_range', {
            subtypeDiff: 'pg_catalog.float8mi',
            multirangeName: 'float_multirange',
            comment: 'Floats',
          }),
          rangeRow(16_901, 'kitchen', 'text_span', {
            subtype: 'text',
            subtypeOpclass: 'pg_catalog.text_pattern_ops',
            collation: 'pg_catalog."C"',
            canonical: 'kitchen.text_span_canonical',
          }),
        ],
      }),
      FACTS
    );

    expect(model.ranges).toStrictEqual([
      {
        kind: 'range',
        oid: 16_900,
        schema: 'kitchen',
        name: 'float_range',
        comment: 'Floats',
        subtype: 'double precision',
        subtypeDiff: 'pg_catalog.float8mi',
        multirange: { schema: 'kitchen', name: 'float_multirange' },
      },
      {
        kind: 'range',
        oid: 16_901,
        schema: 'kitchen',
        name: 'text_span',
        subtype: 'text',
        subtypeOpclass: 'pg_catalog.text_pattern_ops',
        collation: 'pg_catalog."C"',
        canonical: 'kitchen.text_span_canonical',
        multirange: { schema: 'kitchen', name: 'text_span_multirange' },
      },
    ]);
  });

  it('decodes the provider of collations and keeps the locale fields of each provider', () => {
    const model = rowsToModel(
      emptyRows({
        collations: [
          collationRow(17_001, 'kitchen', 'ci', {
            collprovider: 'i',
            collisdeterministic: false,
            locale: 'und-u-ks-level2',
            lcCollate: null,
            lcCtype: null,
            rules: '&a < b',
          }),
          collationRow(17_000, 'kitchen', 'bytewise', {
            comment: 'Byte-wise ordering',
          }),
          collationRow(17_002, 'kitchen', 'c_utf8', {
            collprovider: 'b',
            locale: 'C.UTF-8',
            lcCollate: null,
            lcCtype: null,
          }),
        ],
      }),
      FACTS
    );

    expect(model.collations).toStrictEqual([
      {
        kind: 'collation',
        oid: 17_000,
        schema: 'kitchen',
        name: 'bytewise',
        comment: 'Byte-wise ordering',
        provider: 'libc',
        deterministic: true,
        lcCollate: 'C',
        lcCtype: 'C',
      },
      {
        kind: 'collation',
        oid: 17_002,
        schema: 'kitchen',
        name: 'c_utf8',
        provider: 'builtin',
        deterministic: true,
        locale: 'C.UTF-8',
      },
      {
        kind: 'collation',
        oid: 17_001,
        schema: 'kitchen',
        name: 'ci',
        provider: 'icu',
        deterministic: false,
        locale: 'und-u-ks-level2',
        rules: '&a < b',
      },
    ]);
  });

  describe('sequences', () => {
    it('keeps the options of a sequence as exact int8 text', () => {
      const model = rowsToModel(
        emptyRows({
          sequences: [
            sequenceRow(17_100, 'kitchen', 'huge', {
              start: '9007199254740993',
              minValue: '-9223372036854775808',
              maxValue: '9223372036854775807',
              increment: '-9007199254740993',
              cache: '20',
              cycle: true,
              relpersistence: 'u',
              comment: 'Big numbers',
            }),
          ],
        }),
        FACTS
      );

      expect(model.sequences).toStrictEqual([
        {
          kind: 'sequence',
          oid: 17_100,
          schema: 'kitchen',
          name: 'huge',
          comment: 'Big numbers',
          type: 'bigint',
          start: '9007199254740993',
          increment: '-9007199254740993',
          minValue: '-9223372036854775808',
          maxValue: '9223372036854775807',
          cache: '20',
          cycle: true,
          unlogged: true,
        },
      ]);
    });

    it('records the column that owns a sequence', () => {
      const model = rowsToModel(
        emptyRows({
          sequences: [
            sequenceRow(17_110, 'kitchen', 'ticket_seq', {
              ownerSchema: 'kitchen',
              ownerTable: 'orders',
              ownerColumn: 'ticket_no',
            }),
          ],
        }),
        FACTS
      );

      expect(model.sequences).toStrictEqual([
        {
          kind: 'sequence',
          oid: 17_110,
          schema: 'kitchen',
          name: 'ticket_seq',
          type: 'bigint',
          start: '1',
          increment: '1',
          minValue: '1',
          maxValue: '9223372036854775807',
          cache: '1',
          cycle: false,
          unlogged: false,
          ownedBy: {
            table: { schema: 'kitchen', name: 'orders' },
            column: 'ticket_no',
          },
        },
      ]);
    });
  });

  describe('functions', () => {
    it('builds the arguments of a function without its TABLE columns', () => {
      const definition =
        'CREATE OR REPLACE FUNCTION kitchen.recent_orders(p_days integer DEFAULT 30)\n RETURNS TABLE(order_id bigint, placed_at timestamp with time zone)\n LANGUAGE sql\n STABLE ROWS 1000\nAS $function$ SELECT 1, now() $function$\n';
      const model = rowsToModel(
        emptyRows({
          functions: [
            functionRow(17_200, 'kitchen', 'recent_orders', {
              argTypes: ['integer', 'bigint', 'timestamp with time zone'],
              argNames: ['p_days', 'order_id', 'placed_at'],
              argModes: ['i', 't', 't'],
              argDefaults: ['30', null, null],
              identityArguments: 'p_days integer',
              result:
                'TABLE(order_id bigint, placed_at timestamp with time zone)',
              body: ' SELECT 1, now() ',
              provolatile: 's',
              proretset: true,
              prorows: 1000,
              definition,
              comment: 'Recent orders',
            }),
          ],
        }),
        FACTS
      );

      expect(model.functions).toStrictEqual([
        {
          kind: 'function',
          oid: 17_200,
          schema: 'kitchen',
          name: 'recent_orders',
          comment: 'Recent orders',
          routineKind: 'function',
          arguments: [
            { mode: 'IN', name: 'p_days', type: 'integer', default: '30' },
          ],
          identityArguments: 'p_days integer',
          returns: 'TABLE(order_id bigint, placed_at timestamp with time zone)',
          returnsSet: true,
          language: 'sql',
          body: ' SELECT 1, now() ',
          hasSqlBody: false,
          volatility: 'STABLE',
          strict: false,
          securityDefiner: false,
          leakproof: false,
          parallel: 'UNSAFE',
          cost: 100,
          rows: 1000,
          config: [],
          definition,
        },
      ]);
    });

    it.each([
      [
        'OUT arguments',
        ['text', 'text', 'text'],
        ['full_name', 'first_name', 'last_name'],
        ['i', 'o', 'o'],
        [
          { mode: 'IN', name: 'full_name', type: 'text' },
          { mode: 'OUT', name: 'first_name', type: 'text' },
          { mode: 'OUT', name: 'last_name', type: 'text' },
        ],
      ],
      [
        'a VARIADIC argument',
        ['text', 'text[]'],
        ['sep', 'parts'],
        ['i', 'v'],
        [
          { mode: 'IN', name: 'sep', type: 'text' },
          { mode: 'VARIADIC', name: 'parts', type: 'text[]' },
        ],
      ],
      [
        'an unnamed INOUT argument',
        ['integer', 'integer'],
        ['', 'b'],
        ['b', 'i'],
        [
          { mode: 'INOUT', type: 'integer' },
          { mode: 'IN', name: 'b', type: 'integer' },
        ],
      ],
      [
        'no names and no modes',
        ['integer', 'text'],
        null,
        null,
        [
          { mode: 'IN', type: 'integer' },
          { mode: 'IN', type: 'text' },
        ],
      ],
    ])('decodes %s', (_, argTypes, argNames, argModes, expected) => {
      const model = rowsToModel(
        emptyRows({
          functions: [
            functionRow(17_210, 'kitchen', 'f', {
              argTypes,
              argNames,
              argModes,
              argDefaults: argTypes.map(() => null),
            }),
          ],
        }),
        FACTS
      );

      expect(model.functions[0].arguments).toStrictEqual(expected);
    });

    it('decodes the catalog codes and splits each setting at its first =', () => {
      const model = rowsToModel(
        emptyRows({
          functions: [
            functionRow(17_220, 'kitchen', 'current_tenant', {
              prokind: 'w',
              hasSqlBody: true,
              provolatile: 'i',
              proisstrict: true,
              prosecdef: true,
              proleakproof: true,
              proparallel: 'r',
              procost: 5,
              proconfig: [
                'search_path=pg_catalog, pg_temp',
                'kitchen.note=a=b',
                'datestyle=""',
              ],
            }),
          ],
        }),
        FACTS
      );

      expect(model.functions[0]).toMatchObject({
        routineKind: 'window',
        hasSqlBody: true,
        volatility: 'IMMUTABLE',
        strict: true,
        securityDefiner: true,
        leakproof: true,
        parallel: 'RESTRICTED',
        cost: 5,
        config: [
          { name: 'search_path', value: 'pg_catalog, pg_temp' },
          { name: 'kitchen.note', value: 'a=b' },
          { name: 'datestyle', value: '""' },
        ],
      });
    });

    it('gives a procedure no result', () => {
      const model = rowsToModel(
        emptyRows({
          functions: [
            functionRow(17_230, 'kitchen', 'archive_orders', {
              prokind: 'p',
              result: null,
              language: 'plpgsql',
            }),
          ],
        }),
        FACTS
      );

      expect(model.functions[0].routineKind).toBe('procedure');
      expect(model.functions[0]).not.toHaveProperty('returns');
    });
  });

  it('keeps operators with their types and functions as schema and stored name', () => {
    const model = rowsToModel(
      emptyRows({
        operators: [
          operatorRow(17_300, 'kitchen', '=~=', {
            commutator: { schema: 'kitchen', name: '=~=' },
            negator: { schema: 'kitchen', name: '!~=' },
            restrict: { schema: 'pg_catalog', name: 'eqsel' },
            join: { schema: 'pg_catalog', name: 'eqjoinsel' },
            oprcanhash: true,
            comment: 'Equal within 0.01',
          }),
          operatorRow(17_301, 'kitchen', '~~~', {
            left: null,
            right: { schema: 'pg_catalog', name: 'int4' },
            function: { schema: 'kitchen', name: 'negate' },
            oprcanmerge: true,
            identityArguments: 'NONE, integer',
          }),
        ],
      }),
      FACTS
    );

    expect(model.operators).toStrictEqual([
      {
        kind: 'operator',
        oid: 17_300,
        schema: 'kitchen',
        name: '=~=',
        comment: 'Equal within 0.01',
        left: { schema: 'pg_catalog', name: 'numeric' },
        right: { schema: 'pg_catalog', name: 'numeric' },
        function: { schema: 'kitchen', name: 'roughly_equal' },
        commutator: { schema: 'kitchen', name: '=~=' },
        negator: { schema: 'kitchen', name: '!~=' },
        restrict: { schema: 'pg_catalog', name: 'eqsel' },
        join: { schema: 'pg_catalog', name: 'eqjoinsel' },
        hashes: true,
        merges: false,
        identityArguments: 'numeric, numeric',
      },
      {
        kind: 'operator',
        oid: 17_301,
        schema: 'kitchen',
        name: '~~~',
        right: { schema: 'pg_catalog', name: 'int4' },
        function: { schema: 'kitchen', name: 'negate' },
        hashes: false,
        merges: true,
        identityArguments: 'NONE, integer',
      },
    ]);
  });

  it('decodes casts and sorts them by source, then target', () => {
    const model = rowsToModel(
      emptyRows({
        casts: [
          castRow(17_401, 'kitchen.mood', 'text', {
            castmethod: 'i',
            castcontext: 'i',
          }),
          castRow(17_400, 'character varying', 'integer', {
            castmethod: 'f',
            castcontext: 'a',
            function: { schema: 'kitchen', name: 'varchar_to_int' },
            functionArguments: ['character varying'],
            comment: 'Parses',
          }),
          castRow(17_402, 'kitchen.mood', 'bytea'),
        ],
      }),
      FACTS
    );

    expect(model.casts).toStrictEqual([
      {
        kind: 'cast',
        oid: 17_400,
        comment: 'Parses',
        source: 'character varying',
        target: 'integer',
        method: 'function',
        function: { schema: 'kitchen', name: 'varchar_to_int' },
        functionArguments: ['character varying'],
        context: 'ASSIGNMENT',
      },
      {
        kind: 'cast',
        oid: 17_402,
        source: 'kitchen.mood',
        target: 'bytea',
        method: 'binary',
        functionArguments: [],
        context: 'EXPLICIT',
      },
      {
        kind: 'cast',
        oid: 17_401,
        source: 'kitchen.mood',
        target: 'text',
        method: 'inout',
        functionArguments: [],
        context: 'IMPLICIT',
      },
    ]);
  });

  describe('aggregates', () => {
    it('leaves out the settings a simple aggregate does not have', () => {
      const model = rowsToModel(
        emptyRows({
          aggregates: [
            aggregateRow(17_500, 'kitchen', 'pipe_agg', {
              comment: 'Joins values with |',
            }),
          ],
        }),
        FACTS
      );

      expect(model.aggregates).toStrictEqual([
        {
          kind: 'aggregate',
          oid: 17_500,
          schema: 'kitchen',
          name: 'pipe_agg',
          comment: 'Joins values with |',
          identityArguments: 'text',
          argumentTypes: ['text'],
          stateFunction: 'kitchen.pipe_concat',
          stateType: 'text',
          finalFunctionExtra: false,
          finalFunctionModify: 'READ_ONLY',
          parallel: 'UNSAFE',
        },
      ]);
    });

    it('decodes every setting of an aggregate, the moving ones included', () => {
      const model = rowsToModel(
        emptyRows({
          aggregates: [
            aggregateRow(17_501, 'kitchen', 'avg_plus', {
              identityArguments: 'numeric',
              argTypes: ['numeric'],
              stateFunction: 'kitchen.avg_step',
              stateType: 'numeric[]',
              stateSpace: 64,
              finalFunction: 'kitchen.avg_final',
              aggfinalextra: true,
              aggfinalmodify: 's',
              combineFunction: 'kitchen.avg_combine',
              serialFunction: 'kitchen.avg_serial',
              deserialFunction: 'kitchen.avg_deserial',
              initialCondition: '{0,0}',
              movingStateFunction: 'kitchen.avg_step',
              movingInverseFunction: 'kitchen.avg_unstep',
              movingStateType: 'numeric[]',
              movingStateSpace: 32,
              movingFinalFunction: 'kitchen.avg_final',
              aggmfinalextra: true,
              aggmfinalmodify: 'w',
              movingInitialCondition: '{0,1}',
              sortOperator: 'OPERATOR(pg_catalog.<)',
              proparallel: 's',
            }),
          ],
        }),
        FACTS
      );

      expect(model.aggregates).toStrictEqual([
        {
          kind: 'aggregate',
          oid: 17_501,
          schema: 'kitchen',
          name: 'avg_plus',
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
            initialCondition: '{0,1}',
          },
          sortOperator: 'OPERATOR(pg_catalog.<)',
          parallel: 'SAFE',
        },
      ]);
    });
  });
});
