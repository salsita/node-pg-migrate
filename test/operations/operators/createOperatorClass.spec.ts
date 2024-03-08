import { describe, expect, it } from 'vitest';
import { createOperatorClass } from '../../../src/operations/operators';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('operators', () => {
    describe('createOperatorClass', () => {
      const createOperatorClassFn = createOperatorClass(options1);

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
          `CREATE OPERATOR CLASS "gist__int_ops" DEFAULT FOR TYPE "_int4" USING "gist" FAMILY family_name AS
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
            'DROP OPERATOR CLASS "gist__int_ops" USING gist;'
          );
        });
      });
    });
  });
});
