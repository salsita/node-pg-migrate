import { describe, expect, it } from 'vitest';
import { refreshMaterializedView } from '../../../src/operations/materializedViews';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('materializedViews', () => {
    describe('refreshMaterializedView', () => {
      const refreshMaterializedViewFn = refreshMaterializedView(options1);

      it('should return a function', () => {
        expect(refreshMaterializedViewFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = refreshMaterializedViewFn('order_summary');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('REFRESH MATERIALIZED VIEW "order_summary";');
      });

      it('should return sql statement with materializedViewRefreshOptions', () => {
        const statement = refreshMaterializedViewFn('annual_statistics_basis', {
          concurrently: true,
          data: false,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'REFRESH MATERIALIZED VIEW CONCURRENTLY "annual_statistics_basis" WITH NO DATA;'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = refreshMaterializedViewFn({
          name: 'order_summary',
          schema: 'myschema',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'REFRESH MATERIALIZED VIEW "myschema"."order_summary";'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(refreshMaterializedViewFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = refreshMaterializedViewFn.reverse('order_summary');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('REFRESH MATERIALIZED VIEW "order_summary";');
        });
      });
    });
  });
});
