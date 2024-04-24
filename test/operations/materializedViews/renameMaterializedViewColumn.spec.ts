import { describe, expect, it } from 'vitest';
import { renameMaterializedViewColumn } from '../../../src/operations/materializedViews';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('materializedViews', () => {
    describe('renameMaterializedViewColumn', () => {
      const renameMaterializedViewColumnFn =
        renameMaterializedViewColumn(options1);

      it('should return a function', () => {
        expect(renameMaterializedViewColumnFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renameMaterializedViewColumnFn(
          'a_mview',
          'foo',
          'bar'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER MATERIALIZED VIEW "a_mview" RENAME COLUMN "foo" TO "bar";'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = renameMaterializedViewColumnFn(
          { name: 'a_mview', schema: 'myschema' },
          'foo',
          'bar'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER MATERIALIZED VIEW "myschema"."a_mview" RENAME COLUMN "foo" TO "bar";'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameMaterializedViewColumnFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameMaterializedViewColumnFn.reverse(
            'a_mview',
            'foo',
            'bar'
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER MATERIALIZED VIEW "a_mview" RENAME COLUMN "bar" TO "foo";'
          );
        });
      });
    });
  });
});
