import { describe, expect, it } from 'vitest';
import { assertDecamelizeKeepsNames } from '../../src/baseline/plan';
import type { PartitionIndex, SchemaModel } from '../../src/introspect/types';
import {
  emptyModel,
  makeColumn,
  makeConstraint,
  makeDomain,
  makeFunction,
  makeTable,
} from '../introspect/objects';

// `assertDecamelizeKeepsNames()` must refuse every name that the `pgm` calls
// of a TypeScript or JavaScript baseline take and that decamelize would
// change, not only the names of objects, columns, attributes and arguments:
// constraint names and setting names too.

/**
 * What `assertDecamelizeKeepsNames()` throws for a model with decamelize on,
 * or `undefined` when it accepts the model.
 */
function decamelizeRefusalOf(model: SchemaModel): unknown {
  try {
    assertDecamelizeKeepsNames(model, true);
  } catch (error) {
    return error;
  }

  return undefined;
}

/**
 * The index of a partition, with the fields that say which one it is and
 * how it is created. The settings a partition index can also have (comment,
 * storage parameters, …) do not matter to the guard, so they are left out.
 */
function partitionIndex(fields: Partial<PartitionIndex>): PartitionIndex {
  return fields as PartitionIndex;
}

const parents = makeTable('public', 'parents', {
  columns: [makeColumn('a', 'integer'), makeColumn('b', 'integer')],
});

/**
 * An inheritance child that declares, on PostgreSQL 18, a NOT NULL
 * constraint of its own for a column it only inherits: the baseline adds it
 * with `pgm.addConstraint('children', 'ChildrenBRequired', 'NOT NULL b')`.
 */
const children = makeTable('public', 'children', {
  inherits: [{ schema: 'public', name: 'parents' }],
  columns: [
    makeColumn('a', 'integer', {
      local: false,
      inheritCount: 1,
      inheritance: { parentNotNull: false },
    }),
    makeColumn('b', 'integer', {
      local: false,
      inheritCount: 1,
      notNull: true,
      notNullConstraint: {
        name: 'ChildrenBRequired',
        noInherit: false,
        validated: true,
      },
      inheritance: { parentNotNull: false, localNotNull: true },
    }),
    makeColumn('c', 'integer'),
  ],
});

const partitioned = makeTable('public', 'm', {
  partitioned: true,
  partitionKey: 'RANGE (id)',
  columns: [makeColumn('id', 'integer', { notNull: true })],
});

const partition = makeTable('public', 'm_1', {
  partitionOf: {
    parent: { schema: 'public', name: 'm' },
    bound: 'FOR VALUES FROM (0) TO (10)',
  },
  columns: [
    makeColumn('id', 'integer', {
      notNull: true,
      local: false,
      inheritCount: 1,
    }),
  ],
});

describe('assertDecamelizeKeepsNames with the names of constraints and settings', () => {
  it.each<[string, SchemaModel, ReadonlyArray<string>]>([
    [
      'the name of the CHECK constraint of a domain (createDomain constraintName)',
      emptyModel({
        domains: [
          makeDomain('public', 'posint', 'integer', {
            checks: [
              {
                name: 'PositiveCheck',
                expression: '(VALUE > 0)',
                validated: true,
              },
            ],
          }),
        ],
      }),
      ['"PositiveCheck" (as positive_check)'],
    ],
    [
      'the name of the NOT NULL constraint of a domain (createDomain constraintName)',
      emptyModel({
        domains: [
          makeDomain('public', 'quantity', 'integer', {
            notNull: true,
            notNullConstraintName: 'QuantityRequired',
          }),
        ],
      }),
      ['"QuantityRequired" (as quantity_required)'],
    ],
    [
      'the name of the NOT NULL constraint of an inheritance child (addConstraint)',
      emptyModel({ tables: [children, parents] }),
      ['"ChildrenBRequired" (as children_b_required)'],
    ],
    [
      'the name of the key of a partition (addConstraint, before the key of its partitioned table)',
      emptyModel({
        tables: [partitioned, partition],
        constraints: [
          makeConstraint(
            partitioned,
            'm_pkey',
            'primaryKey',
            'PRIMARY KEY (id)',
            {
              partitionIndexes: [
                partitionIndex({
                  table: { schema: 'public', name: 'm_1' },
                  name: 'PartKey',
                  columns: ['id'],
                  definition:
                    'CREATE UNIQUE INDEX "PartKey" ON public.m_1 USING btree (id)',
                  constraintDefinition: 'PRIMARY KEY (id)',
                  level: 1,
                }),
              ],
            }
          ),
        ],
      }),
      ['"PartKey" (as part_key)'],
    ],
    [
      'the names of the settings of a function (createFunction set configurationParameter)',
      emptyModel({
        functions: [
          makeFunction('public', 'tenant', {
            returns: 'text',
            config: [
              { name: 'TimeZone', value: 'UTC' },
              { name: 'myApp.tenantId', value: 'acme' },
            ],
          }),
        ],
      }),
      ['"TimeZone" (as time_zone)', '"myApp.tenantId" (as my_app.tenant_id)'],
    ],
  ])('refuses %s, which decamelize would rename', (_, model, fragments) => {
    const error = decamelizeRefusalOf(model);

    expect(error).toMatchObject({ code: 'INVALID_OPTIONS' });
    for (const fragment of fragments) {
      expect(error).toHaveProperty(
        'message',
        expect.stringContaining(fragment)
      );
    }
  });

  it('accepts constraint and setting names that decamelize keeps, whatever the values of the settings', () => {
    const model = emptyModel({
      domains: [
        makeDomain('public', 'posint', 'integer', {
          checks: [
            {
              name: 'posint_check',
              expression: '(VALUE > 0)',
              validated: true,
            },
          ],
        }),
      ],
      functions: [
        makeFunction('public', 'tuned', {
          config: [
            { name: 'work_mem', value: '64MB' },
            { name: 'search_path', value: '"$user", public' },
          ],
        }),
      ],
    });

    expect(decamelizeRefusalOf(model)).toBeUndefined();
  });
});

describe('assertDecamelizeKeepsNames with names that pgm calls do not take', () => {
  it('accepts the settings of a function that raw SQL creates, which decamelize does not change', () => {
    const model = emptyModel({
      functions: [
        makeFunction('public', 'tenant', {
          leakproof: true,
          config: [{ name: 'TimeZone', value: 'UTC' }],
        }),
      ],
    });

    expect(decamelizeRefusalOf(model)).toBeUndefined();
  });

  it('leaves out the NOT NULL constraint of a domain with the name createDomain gives it', () => {
    const error = decamelizeRefusalOf(
      emptyModel({
        domains: [
          makeDomain('public', 'Money', 'numeric', {
            notNull: true,
            notNullConstraintName: 'Money_not_null',
          }),
        ],
      })
    );

    expect(error).toMatchObject({ code: 'INVALID_OPTIONS' });
    expect(error).toHaveProperty(
      'message',
      expect.stringContaining('"Money" (as money)')
    );
    expect(error).toHaveProperty(
      'message',
      expect.not.stringContaining('Money_not_null')
    );
  });

  it('names the constraints of tables that are not partitioned, sorted with the other names', () => {
    const zeta = makeTable('public', 'Zeta');
    const alpha = makeTable('public', 'Alpha');
    const error = decamelizeRefusalOf(
      emptyModel({
        tables: [zeta, alpha],
        constraints: [
          makeConstraint(alpha, 'AlphaPkey', 'primaryKey', 'PRIMARY KEY (id)'),
        ],
      })
    );

    expect(error).toHaveProperty(
      'message',
      expect.stringContaining(
        '"Alpha" (as alpha), "AlphaPkey" (as alpha_pkey), "Zeta" (as zeta).'
      )
    );
  });
});
