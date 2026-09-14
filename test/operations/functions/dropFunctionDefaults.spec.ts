import { describe, expect, it, vi } from 'vitest';
import type { FunctionParam } from '../../../src';
import { MigrationBuilder, PgLiteral } from '../../../src';
import {
  createFunction,
  dropFunction,
} from '../../../src/operations/functions';
import { options2 } from '../../presetMigrationOptions';

const typeShorthands = Object.freeze({
  inherited: Object.freeze({ type: 'int', default: 2 }),
  nested: 'inherited',
  zero: Object.freeze({ type: 'int', default: 0 }),
  falseValue: Object.freeze({ type: 'bool', default: false }),
  emptyString: Object.freeze({ type: 'string', default: '' }),
  nullValue: Object.freeze({ type: 'integer', default: null }),
  expression: Object.freeze({
    type: 'integer',
    default: PgLiteral.create('1 + 2'),
  }),
  variadic: Object.freeze({
    type: 'integer[]',
    default: PgLiteral.create('ARRAY[1, 2]'),
  }),
});

const cases: Array<{
  title: string;
  params: FunctionParam[];
  identity: string;
  definition: string;
}> = [
  {
    title: 'explicit default',
    params: [{ mode: 'IN', name: 'inputValue', type: 'integer', default: 1 }],
    identity: '(IN "input_value" integer)',
    definition: '(IN "input_value" integer DEFAULT 1)',
  },
  {
    title: 'string shorthand',
    params: ['inherited'],
    identity: '(integer)',
    definition: '(integer DEFAULT 2)',
  },
  {
    title: 'object shorthand',
    params: [{ name: 'inputValue', type: 'inherited' }],
    identity: '("input_value" integer)',
    definition: '("input_value" integer DEFAULT 2)',
  },
  {
    title: 'chained string shorthand',
    params: ['nested'],
    identity: '(integer)',
    definition: '(integer DEFAULT 2)',
  },
  {
    title: 'chained object shorthand',
    params: [{ name: 'inputValue', type: 'nested' }],
    identity: '("input_value" integer)',
    definition: '("input_value" integer DEFAULT 2)',
  },
  {
    title: 'zero shorthand',
    params: ['zero'],
    identity: '(integer)',
    definition: '(integer DEFAULT 0)',
  },
  {
    title: 'false shorthand',
    params: [{ mode: 'IN', name: 'inputValue', type: 'falseValue' }],
    identity: '(IN "input_value" boolean)',
    definition: '(IN "input_value" boolean DEFAULT false)',
  },
  {
    title: 'empty string shorthand',
    params: ['emptyString'],
    identity: '(text)',
    definition: '(text DEFAULT $pga$$pga$)',
  },
  {
    title: 'null shorthand',
    params: ['nullValue'],
    identity: '(integer)',
    definition: '(integer DEFAULT NULL)',
  },
  {
    title: 'literal shorthand',
    params: ['expression'],
    identity: '(integer)',
    definition: '(integer DEFAULT 1 + 2)',
  },
  {
    title: 'overridden shorthand',
    params: [{ type: 'nested', default: 3 }],
    identity: '(integer)',
    definition: '(integer DEFAULT 3)',
  },
  {
    title: 'undefined override',
    params: [{ type: 'nested', default: undefined }],
    identity: '(integer)',
    definition: '(integer)',
  },
  {
    title: 'INOUT shorthand',
    params: [{ mode: 'INOUT', name: 'inputValue', type: 'inherited' }],
    identity: '(INOUT "input_value" integer)',
    definition: '(INOUT "input_value" integer DEFAULT 2)',
  },
  {
    title: 'OUT with defaulted input',
    params: [
      { mode: 'IN', type: 'inherited' },
      { mode: 'OUT', type: 'text' },
    ],
    identity: '(IN integer, OUT text)',
    definition: '(IN integer DEFAULT 2, OUT text)',
  },
  {
    title: 'VARIADIC shorthand',
    params: [{ mode: 'VARIADIC', type: 'variadic' }],
    identity: '(VARIADIC integer[])',
    definition: '(VARIADIC integer[] DEFAULT ARRAY[1, 2])',
  },
  {
    title: 'quoted name and qualified type',
    params: [{ name: 'a"b', type: '"types"."custom_type"', default: null }],
    identity: '("a""b" "types"."custom_type")',
    definition: '("a""b" "types"."custom_type" DEFAULT NULL)',
  },
];

describe.each(['dropFunction', 'createFunction.reverse'] as const)(
  '%s defaults',
  (operation) => {
    it.each(cases)(
      'omits $title without changing creation or inputs',
      ({ params, identity, definition }) => {
        for (const param of params) {
          if (typeof param === 'object') {
            Object.freeze(param);
          }
        }
        Object.freeze(params);
        const options = { ...options2, typeShorthands };
        const source = { schema: 'appSchema', name: 'defaultedFunction' };
        const functionOptions = { language: 'sql', returns: 'integer' };
        const create = createFunction(options);
        const creationBefore = create(
          source,
          params,
          functionOptions,
          'SELECT 1'
        );
        expect(creationBefore).toContain(
          `"app_schema"."defaulted_function"${definition}`
        );

        const expected = `DROP FUNCTION "app_schema"."defaulted_function"${identity};`;
        const statement =
          operation === 'dropFunction'
            ? dropFunction(options)(source, params)
            : create.reverse(source, params, functionOptions, 'SELECT 1');
        expect(statement).toBe(expected);

        const pgm = new MigrationBuilder(
          { query: vi.fn(), select: vi.fn() },
          typeShorthands,
          true,
          console
        );
        if (operation === 'dropFunction') {
          pgm.dropFunction(source, params);
        } else {
          pgm.enableReverseMode();
          pgm.createFunction(source, params, functionOptions, 'SELECT 1');
        }
        expect(pgm.getSqlSteps()).toEqual([expected]);
        expect(create(source, params, functionOptions, 'SELECT 1')).toBe(
          creationBefore
        );
      }
    );

    it('preserves drop options with a defaulted shorthand', () => {
      const options = { ...options2, typeShorthands };
      const dropOptions = { ifExists: true, cascade: true };
      const statement =
        operation === 'dropFunction'
          ? dropFunction(options)('defaultedFunction', ['nested'], dropOptions)
          : createFunction(options).reverse(
              'defaultedFunction',
              ['nested'],
              { ...dropOptions, language: 'sql' },
              'SELECT 1'
            );
      expect(statement).toBe(
        'DROP FUNCTION IF EXISTS "defaulted_function"(integer) CASCADE;'
      );
    });

    it('does not render an unused shorthand default expression', () => {
      const renderDefault = vi.fn(() => {
        throw new Error('Unexpected default rendering');
      });
      const options = {
        ...options2,
        typeShorthands: {
          unused: {
            type: 'integer',
            default: {
              literal: true as const,
              get value() {
                return renderDefault();
              },
              toString: renderDefault,
            },
          },
        },
      };
      const statement =
        operation === 'dropFunction'
          ? dropFunction(options)('defaultedFunction', ['unused'])
          : createFunction(options).reverse(
              'defaultedFunction',
              ['unused'],
              { language: 'sql' },
              'SELECT 1'
            );
      expect(statement).toBe('DROP FUNCTION "defaulted_function"(integer);');
      expect(renderDefault).not.toHaveBeenCalled();
    });
  }
);
