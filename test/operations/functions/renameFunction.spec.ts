import { describe, expect, it } from 'vitest';
import type { FunctionParam } from '../../../src';
import { renameFunction } from '../../../src/operations/functions';
import { options1, options2 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('functions', () => {
    describe('renameFunction', () => {
      const renameFunctionFn = renameFunction(options1);

      it('should return a function', () => {
        expect(renameFunctionFn).toBeTypeOf('function');
      });

      it('should return sql statement for a function signature', () => {
        const statement = renameFunctionFn('sqrt', ['integer'], 'square_root');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER FUNCTION "sqrt"(integer) RENAME TO "square_root";'
        );
      });

      describe.each(['up', 'down'] as const)('%s identity', (direction) => {
        const rename = renameFunction({
          ...options2,
          typeShorthands: { customId: 'integer' },
        });
        const operation = direction === 'down' ? rename.reverse : rename;
        const identities: Array<{ params: FunctionParam[]; sql: string }> = [
          { params: [], sql: '()' },
          { params: ['integer', 'text[]'], sql: '(integer, text[])' },
          { params: ['customId'], sql: '(integer)' },
          {
            params: ['"custom_schema"."custom_type"'],
            sql: '("custom_schema"."custom_type")',
          },
          {
            params: [
              { mode: 'IN', name: 'inputValue', type: 'integer' },
              { mode: 'OUT', name: 'resultValue', type: 'text' },
            ],
            sql: '(IN "input_value" integer, OUT "result_value" text)',
          },
          {
            params: [{ mode: 'INOUT', name: 'mixedValue', type: 'integer' }],
            sql: '(INOUT "mixed_value" integer)',
          },
          {
            params: [{ mode: 'VARIADIC', name: 'otherValues', type: 'text[]' }],
            sql: '(VARIADIC "other_values" text[])',
          },
        ];

        it.each(identities)(
          'preserves the signature $sql',
          ({ params, sql }) => {
            expect(
              operation({ schema: 'appSchema', name: 'oldName' }, params, {
                schema: 'app_schema',
                name: 'newName',
              })
            ).toBe(
              direction === 'down'
                ? `ALTER FUNCTION "app_schema"."new_name"${sql} RENAME TO "old_name";`
                : `ALTER FUNCTION "app_schema"."old_name"${sql} RENAME TO "new_name";`
            );
          }
        );

        it('defaults undefined parameters to an empty signature at runtime', () => {
          expect(
            Reflect.apply(operation, undefined, [
              { schema: 'appSchema', name: 'oldName' },
              undefined,
              'newName',
            ])
          ).toBe(
            direction === 'down'
              ? 'ALTER FUNCTION "app_schema"."new_name"() RENAME TO "old_name";'
              : 'ALTER FUNCTION "app_schema"."old_name"() RENAME TO "new_name";'
          );
        });
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameFunctionFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameFunctionFn.reverse(
            'sqrt',
            ['integer'],
            'square_root'
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER FUNCTION "square_root"(integer) RENAME TO "sqrt";'
          );
        });
      });
    });
  });
});
