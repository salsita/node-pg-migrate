import { describe, expect, it } from 'vitest';
import { alterViewColumn } from '../../../src/operations/views';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('views', () => {
    describe('alterViewColumn', () => {
      const alterViewColumnFn = alterViewColumn(options1);

      it('should return a function', () => {
        expect(alterViewColumnFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = alterViewColumnFn('a_view', 'ts', {});

        expect(statement).toBeTypeOf('string');
        expect(statement).toHaveLength(0);
      });

      it('should return sql statement with viewColumnOptions', () => {
        const statement = alterViewColumnFn('a_view', 'ts', {
          default: 'now()',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER VIEW "a_view" ALTER COLUMN "ts" SET DEFAULT $pga$now()$pga$;'
        );
      });

      it('should return sql statement with viewColumnOptions drop default', () => {
        const statement = alterViewColumnFn('a_view', 'ts', {
          default: null,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER VIEW "a_view" ALTER COLUMN "ts" DROP DEFAULT;'
        );
      });
    });
  });
});
