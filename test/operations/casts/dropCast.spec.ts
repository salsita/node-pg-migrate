import { describe, expect, it } from 'vitest';
import { dropCast } from '../../../src/operations/casts';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('casts', () => {
    describe('dropCast', () => {
      const dropCastFn = dropCast(options1);

      it('should return a function', () => {
        expect(dropCastFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropCastFn('bigint', 'int4', {});

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP CAST (bigint AS int4);');
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropCastFn('bigint', 'int4', {
          ifExists: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP CAST IF EXISTS (bigint AS int4);');
      });
    });
  });
});
