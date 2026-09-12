import { describe, expect, it, vi } from 'vitest';
import type { FunctionParam } from '../../../src';
import { MigrationBuilder, PgLiteral } from '../../../src';
import {
  createFunction,
  renameFunction,
} from '../../../src/operations/functions';
import { options2 } from '../../presetMigrationOptions';

const typeShorthands = Object.freeze({
  inherited: Object.freeze({ type: 'int', default: 2 }),
  nested: 'inherited',
});

const cases: Array<{
  title: string;
  params: FunctionParam[];
  identity: string;
  definition: string;
}> = [
  {
    title: 'named input',
    params: [{ mode: 'IN', name: 'inputValue', type: 'integer', default: 1 }],
    identity: '(IN "input_value" integer)',
    definition: '(IN "input_value" integer DEFAULT 1)',
  },
  {
    title: 'zero',
    params: [{ type: 'int', default: 0 }],
    identity: '(integer)',
    definition: '(integer DEFAULT 0)',
  },
  {
    title: 'false',
    params: [{ type: 'bool', default: false }],
    identity: '(boolean)',
    definition: '(boolean DEFAULT false)',
  },
  {
    title: 'empty string',
    params: [{ type: 'string', default: '' }],
    identity: '(text)',
    definition: '(text DEFAULT $pga$$pga$)',
  },
  {
    title: 'null',
    params: [{ type: 'integer', default: null }],
    identity: '(integer)',
    definition: '(integer DEFAULT NULL)',
  },
  {
    title: 'literal expression',
    params: [{ type: 'integer', default: PgLiteral.create('1 + 2') }],
    identity: '(integer)',
    definition: '(integer DEFAULT 1 + 2)',
  },
  {
    title: 'string shorthand',
    params: ['inherited'],
    identity: '(integer)',
    definition: '(integer DEFAULT 2)',
  },
  {
    title: 'nested object shorthand',
    params: [{ name: 'inputValue', type: 'nested' }],
    identity: '("input_value" integer)',
    definition: '("input_value" integer DEFAULT 2)',
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
    title: 'INOUT',
    params: [
      { mode: 'INOUT', name: 'inputValue', type: 'integer', default: 1 },
    ],
    identity: '(INOUT "input_value" integer)',
    definition: '(INOUT "input_value" integer DEFAULT 1)',
  },
  {
    title: 'OUT with input default',
    params: [
      { mode: 'IN', type: 'integer', default: 1 },
      { mode: 'OUT', type: 'integer' },
    ],
    identity: '(IN integer, OUT integer)',
    definition: '(IN integer DEFAULT 1, OUT integer)',
  },
  {
    title: 'VARIADIC',
    params: [
      {
        mode: 'VARIADIC',
        type: 'integer[]',
        default: PgLiteral.create('ARRAY[1, 2]'),
      },
    ],
    identity: '(VARIADIC integer[])',
    definition: '(VARIADIC integer[] DEFAULT ARRAY[1, 2])',
  },
];

describe('renameFunction defaults', () => {
  describe.each(['up', 'down'] as const)('%s', (direction) => {
    it.each(cases)(
      'omits $title defaults without changing creation or inputs',
      ({ params, identity, definition }) => {
        for (const param of params) {
          if (typeof param === 'object') {
            Object.freeze(param);
          }
        }
        Object.freeze(params);
        const options = { ...options2, typeShorthands };
        const source = { schema: 'appSchema', name: 'oldName' };
        const destination = { schema: 'app_schema', name: 'newName' };
        const create = createFunction(options);
        const creationBefore = create(
          source,
          params,
          { language: 'sql', returns: 'integer' },
          'SELECT 1'
        );
        expect(creationBefore).toContain(
          `"app_schema"."old_name"${definition}`
        );

        const rename = renameFunction(options);
        const expected =
          direction === 'down'
            ? `ALTER FUNCTION "app_schema"."new_name"${identity} RENAME TO "old_name";`
            : `ALTER FUNCTION "app_schema"."old_name"${identity} RENAME TO "new_name";`;
        expect(
          (direction === 'down' ? rename.reverse : rename)(
            source,
            params,
            destination
          )
        ).toBe(expected);

        const pgm = new MigrationBuilder(
          { query: vi.fn(), select: vi.fn() },
          typeShorthands,
          true,
          console
        );
        if (direction === 'down') {
          pgm.enableReverseMode();
        }
        pgm.renameFunction(source, params, destination);
        expect(pgm.getSqlSteps()).toEqual([expected]);
        expect(
          create(
            source,
            params,
            { language: 'sql', returns: 'integer' },
            'SELECT 1'
          )
        ).toBe(creationBefore);
      }
    );

    it('does not render an unused default expression', () => {
      const toString = vi.fn(() => {
        throw new Error('Unexpected default rendering');
      });
      const rename = renameFunction(options2);
      const fn = direction === 'down' ? rename.reverse : rename;
      expect(
        fn(
          'old',
          [
            {
              type: 'integer',
              default: { literal: true, value: 'unused', toString },
            },
          ],
          'new'
        )
      ).toBe(
        direction === 'down'
          ? 'ALTER FUNCTION "new"(integer) RENAME TO "old";'
          : 'ALTER FUNCTION "old"(integer) RENAME TO "new";'
      );
      expect(toString).not.toHaveBeenCalled();
    });
  });
});
