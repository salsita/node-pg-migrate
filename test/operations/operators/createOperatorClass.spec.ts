import { describe, expect, it } from 'vitest';
import { createOperatorClass } from '../../../src/operations/operators';
import {
  options1,
  options1Pretty,
  options2,
} from '../../presetMigrationOptions';

describe('operations', () => {
  describe('operators', () => {
    describe('createOperatorClass', () => {
      const createOperatorClassFn = createOperatorClass(options1);

      it.each([
        [false, 'btree', '"btree"'],
        [true, 'btree', '"btree"'],
        [false, 'myMethod', '"myMethod"'],
        [true, 'myMethod', '"my_method"'],
        [false, 'my_method', '"my_method"'],
        [true, 'my_method', '"my_method"'],
        [false, 'Custom.Method', '"Custom.Method"'],
        [true, 'Custom.Method', '"custom.method"'],
        [false, 'my"Method', '"my""Method"'],
        [true, 'my"Method', '"my""method"'],
      ])(
        'should use the same access method for creation and reversal (decamelize: %s, method: %s)',
        (shouldDecamelize, indexMethod, renderedMethod) => {
          const mOptions = shouldDecamelize ? options2 : options1;
          const create = createOperatorClass(mOptions);
          const name = { schema: 'app', name: 'class_name' };

          expect(create(name, 'int4', indexMethod, [], {})).toBe(
            `CREATE OPERATOR CLASS "app"."class_name" FOR TYPE "int4" USING ${renderedMethod} AS ;`
          );
          expect(create.reverse(name, 'int4', indexMethod, [], {})).toBe(
            `DROP OPERATOR CLASS "app"."class_name" USING ${renderedMethod};`
          );
          expect(
            create.reverse(name, 'int4', indexMethod, [], {
              ifExists: true,
              cascade: true,
            })
          ).toBe(
            `DROP OPERATOR CLASS IF EXISTS "app"."class_name" USING ${renderedMethod} CASCADE;`
          );
        }
      );

      it('should return a function', () => {
        expect(createOperatorClassFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = createOperatorClassFn(
          'gist__int_ops',
          '_int4',
          'gist',
          [
            {
              type: 'operator',
              number: 3,
              name: '&&',
            },
            {
              type: 'operator',
              number: 6,
              name: '=',
              params: [{ type: 'anyarray' }, { type: 'anyarray' }],
            },
            {
              type: 'operator',
              number: 7,
              name: '@>',
            },
            {
              type: 'operator',
              number: 8,
              name: '<@',
            },
            {
              type: 'operator',
              number: 20,
              name: '@@',
              params: [{ type: '_int4' }, { type: 'query_int' }],
            },
            {
              type: 'function',
              number: 1,
              name: 'g_int_consistent',
              params: [
                { type: 'internal' },
                { type: '_int4' },
                { type: 'smallint' },
                { type: 'oid' },
                { type: 'internal' },
              ],
            },
            {
              type: 'function',
              number: 2,
              name: 'g_int_union',
              params: [{ type: 'internal' }, { type: 'internal' }],
            },
            {
              type: 'function',
              number: 3,
              name: 'g_int_compress',
              params: [{ type: 'internal' }],
            },
            {
              type: 'function',
              number: 4,
              name: 'g_int_decompress',
              params: [{ type: 'internal' }],
            },
            {
              type: 'function',
              number: 5,
              name: 'g_int_penalty',
              params: [
                { type: 'internal' },
                { type: 'internal' },
                { type: 'internal' },
              ],
            },
            {
              type: 'function',
              number: 6,
              name: 'g_int_picksplit',
              params: [{ type: 'internal' }, { type: 'internal' }],
            },
            {
              type: 'function',
              number: 7,
              name: 'g_int_same',
              params: [
                { type: '_int4' },
                { type: '_int4' },
                { type: 'internal' },
              ],
            },
          ],
          {
            default: true,
          }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `CREATE OPERATOR CLASS "gist__int_ops" DEFAULT FOR TYPE "_int4" USING "gist" AS OPERATOR 3 "&&", OPERATOR 6 "="(anyarray, anyarray), OPERATOR 7 "@>", OPERATOR 8 "<@", OPERATOR 20 "@@"(_int4, query_int), FUNCTION 1 "g_int_consistent"(internal, _int4, smallint, oid, internal), FUNCTION 2 "g_int_union"(internal, internal), FUNCTION 3 "g_int_compress"(internal), FUNCTION 4 "g_int_decompress"(internal), FUNCTION 5 "g_int_penalty"(internal, internal, internal), FUNCTION 6 "g_int_picksplit"(internal, internal), FUNCTION 7 "g_int_same"(_int4, _int4, internal);`
        );
      });

      it('should format the statement across multiple lines when pretty is enabled', () => {
        const statement = createOperatorClass(options1Pretty)(
          'gist__int_ops',
          '_int4',
          'gist',
          [
            {
              type: 'operator',
              number: 3,
              name: '&&',
            },
            {
              type: 'operator',
              number: 6,
              name: '=',
              params: [{ type: 'anyarray' }, { type: 'anyarray' }],
            },
            {
              type: 'operator',
              number: 7,
              name: '@>',
            },
            {
              type: 'operator',
              number: 8,
              name: '<@',
            },
            {
              type: 'operator',
              number: 20,
              name: '@@',
              params: [{ type: '_int4' }, { type: 'query_int' }],
            },
            {
              type: 'function',
              number: 1,
              name: 'g_int_consistent',
              params: [
                { type: 'internal' },
                { type: '_int4' },
                { type: 'smallint' },
                { type: 'oid' },
                { type: 'internal' },
              ],
            },
            {
              type: 'function',
              number: 2,
              name: 'g_int_union',
              params: [{ type: 'internal' }, { type: 'internal' }],
            },
            {
              type: 'function',
              number: 3,
              name: 'g_int_compress',
              params: [{ type: 'internal' }],
            },
            {
              type: 'function',
              number: 4,
              name: 'g_int_decompress',
              params: [{ type: 'internal' }],
            },
            {
              type: 'function',
              number: 5,
              name: 'g_int_penalty',
              params: [
                { type: 'internal' },
                { type: 'internal' },
                { type: 'internal' },
              ],
            },
            {
              type: 'function',
              number: 6,
              name: 'g_int_picksplit',
              params: [{ type: 'internal' }, { type: 'internal' }],
            },
            {
              type: 'function',
              number: 7,
              name: 'g_int_same',
              params: [
                { type: '_int4' },
                { type: '_int4' },
                { type: 'internal' },
              ],
            },
          ],
          {
            default: true,
          }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `CREATE OPERATOR CLASS "gist__int_ops" DEFAULT FOR TYPE "_int4" USING "gist" AS
  OPERATOR 3 "&&",
  OPERATOR 6 "="(anyarray, anyarray),
  OPERATOR 7 "@>",
  OPERATOR 8 "<@",
  OPERATOR 20 "@@"(_int4, query_int),
  FUNCTION 1 "g_int_consistent"(internal, _int4, smallint, oid, internal),
  FUNCTION 2 "g_int_union"(internal, internal),
  FUNCTION 3 "g_int_compress"(internal),
  FUNCTION 4 "g_int_decompress"(internal),
  FUNCTION 5 "g_int_penalty"(internal, internal, internal),
  FUNCTION 6 "g_int_picksplit"(internal, internal),
  FUNCTION 7 "g_int_same"(_int4, _int4, internal);`
        );
      });

      it('should return sql statement with operatorClassOptions', () => {
        const statement = createOperatorClassFn(
          'gist__int_ops',
          '_int4',
          'gist',
          [
            {
              type: 'operator',
              number: 3,
              name: '&&',
            },
            {
              type: 'operator',
              number: 6,
              name: '=',
              params: [{ type: 'anyarray' }, { type: 'anyarray' }],
            },
            {
              type: 'operator',
              number: 7,
              name: '@>',
            },
            {
              type: 'operator',
              number: 8,
              name: '<@',
            },
            {
              type: 'operator',
              number: 20,
              name: '@@',
              params: [{ type: '_int4' }, { type: 'query_int' }],
            },
            {
              type: 'function',
              number: 1,
              name: 'g_int_consistent',
              params: [
                { type: 'internal' },
                { type: '_int4' },
                { type: 'smallint' },
                { type: 'oid' },
                { type: 'internal' },
              ],
            },
            {
              type: 'function',
              number: 2,
              name: 'g_int_union',
              params: [{ type: 'internal' }, { type: 'internal' }],
            },
            {
              type: 'function',
              number: 3,
              name: 'g_int_compress',
              params: [{ type: 'internal' }],
            },
            {
              type: 'function',
              number: 4,
              name: 'g_int_decompress',
              params: [{ type: 'internal' }],
            },
            {
              type: 'function',
              number: 5,
              name: 'g_int_penalty',
              params: [
                { type: 'internal' },
                { type: 'internal' },
                { type: 'internal' },
              ],
            },
            {
              type: 'function',
              number: 6,
              name: 'g_int_picksplit',
              params: [{ type: 'internal' }, { type: 'internal' }],
            },
            {
              type: 'function',
              number: 7,
              name: 'g_int_same',
              params: [
                { type: '_int4' },
                { type: '_int4' },
                { type: 'internal' },
              ],
            },
          ],
          {
            default: true,
            family: 'family_name',
          }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toStrictEqual(
          `CREATE OPERATOR CLASS "gist__int_ops" DEFAULT FOR TYPE "_int4" USING "gist" FAMILY family_name AS OPERATOR 3 "&&", OPERATOR 6 "="(anyarray, anyarray), OPERATOR 7 "@>", OPERATOR 8 "<@", OPERATOR 20 "@@"(_int4, query_int), FUNCTION 1 "g_int_consistent"(internal, _int4, smallint, oid, internal), FUNCTION 2 "g_int_union"(internal, internal), FUNCTION 3 "g_int_compress"(internal), FUNCTION 4 "g_int_decompress"(internal), FUNCTION 5 "g_int_penalty"(internal, internal, internal), FUNCTION 6 "g_int_picksplit"(internal, internal), FUNCTION 7 "g_int_same"(_int4, _int4, internal);`
        );
      });

      it('should return sql statement with schema', () => {});

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(createOperatorClassFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = createOperatorClassFn.reverse(
            'gist__int_ops',
            '_int4',
            'gist',
            [
              {
                type: 'operator',
                number: 3,
                name: '&&',
              },
              {
                type: 'operator',
                number: 6,
                name: '=',
                params: [{ type: 'anyarray' }, { type: 'anyarray' }],
              },
              {
                type: 'operator',
                number: 7,
                name: '@>',
              },
              {
                type: 'operator',
                number: 8,
                name: '<@',
              },
              {
                type: 'operator',
                number: 20,
                name: '@@',
                params: [{ type: '_int4' }, { type: 'query_int' }],
              },
              {
                type: 'function',
                number: 1,
                name: 'g_int_consistent',
                params: [
                  { type: 'internal' },
                  { type: '_int4' },
                  { type: 'smallint' },
                  { type: 'oid' },
                  { type: 'internal' },
                ],
              },
              {
                type: 'function',
                number: 2,
                name: 'g_int_union',
                params: [{ type: 'internal' }, { type: 'internal' }],
              },
              {
                type: 'function',
                number: 3,
                name: 'g_int_compress',
                params: [{ type: 'internal' }],
              },
              {
                type: 'function',
                number: 4,
                name: 'g_int_decompress',
                params: [{ type: 'internal' }],
              },
              {
                type: 'function',
                number: 5,
                name: 'g_int_penalty',
                params: [
                  { type: 'internal' },
                  { type: 'internal' },
                  { type: 'internal' },
                ],
              },
              {
                type: 'function',
                number: 6,
                name: 'g_int_picksplit',
                params: [{ type: 'internal' }, { type: 'internal' }],
              },
              {
                type: 'function',
                number: 7,
                name: 'g_int_same',
                params: [
                  { type: '_int4' },
                  { type: '_int4' },
                  { type: 'internal' },
                ],
              },
            ],
            {
              default: true,
            }
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toStrictEqual(
            'DROP OPERATOR CLASS "gist__int_ops" USING "gist";'
          );
        });
      });
    });
  });
});
