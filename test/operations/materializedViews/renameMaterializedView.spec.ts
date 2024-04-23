import { describe, expect, it } from 'vitest';
import { renameMaterializedView } from '../../../src/operations/materializedViews';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('materializedViews', () => {
    describe('renameMaterializedView', () => {
      const renameMaterializedViewFn = renameMaterializedView(options1);

      it('should return a function', () => {
        expect(renameMaterializedViewFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renameMaterializedViewFn('foo', 'bar');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER MATERIALIZED VIEW "foo" RENAME TO "bar";'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = renameMaterializedViewFn(
          { name: 'foo', schema: 'myschema' },
          { name: 'bar', schema: 'myschema' }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER MATERIALIZED VIEW "myschema"."foo" RENAME TO "myschema"."bar";'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameMaterializedViewFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameMaterializedViewFn.reverse('foo', 'bar');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER MATERIALIZED VIEW "bar" RENAME TO "foo";'
          );
        });
      });
    });
  });
});
