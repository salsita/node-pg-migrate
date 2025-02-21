import { describe, expect, it } from 'vitest';
import type { FunctionParam } from '../../src';
import { PgType } from '../../src';
import type { MigrationOptions } from '../../src/migrationOptions';
import { formatParams } from '../../src/utils';
import { options1 } from '../presetMigrationOptions';

describe('utils', () => {
  describe('formatParams', () => {
    // TODO @Shinigami92 2024-04-04: Should this throw an error if empty array was passed?
    it('should return empty braces', () => {
      const actual = formatParams([], options1);

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('()');
    });

    it('should apply default shorthand', () => {
      const actual = formatParams(
        [
          { type: 'int' },
          { type: 'string' },
          { type: 'float' },
          { type: 'double' },
          { type: 'datetime' },
          { type: 'bool' },
        ],
        options1
      );

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe(
        '(integer, text, real, double precision, timestamp, boolean)'
      );
    });

    it('should consume PgType value', () => {
      const actual = formatParams([{ type: PgType.BYTEA }], options1);

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('(bytea)');
    });

    it('should consume simple string type params', () => {
      const actual = formatParams(['int', 'bigint'], options1);

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('(integer, bigint)');
    });

    it('should consume complex object params', () => {
      const actual = formatParams(
        [
          {
            mode: 'OUT',
            name: 'test',
            type: PgType.BIGINT,
            default: true,
          },
          {
            mode: 'INOUT',
            name: 'test2',
            type: PgType.BOX,
            default: false,
          },
        ],
        options1
      );

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe(
        '(OUT "test" bigint DEFAULT true, INOUT "test2" box)'
      );
    });

    it('should be immutable', () => {
      const params: ReadonlyArray<FunctionParam> = Object.freeze([
        'int',
        PgType.BIGINT,
        {
          mode: 'OUT',
          name: 'test',
          type: 'bigint',
          default: true,
        },
        {
          mode: 'VARIADIC',
          name: 'test2',
          type: PgType.BOX,
          default: false,
        },
      ]);
      const mOptions: Readonly<MigrationOptions> = Object.freeze(options1);
      const actual = formatParams(params, mOptions);

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe(
        '(integer, bigint, OUT "test" bigint DEFAULT true, VARIADIC "test2" box)'
      );
    });
  });
});
