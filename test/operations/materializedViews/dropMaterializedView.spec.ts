import { describe, expect, it } from 'vitest';
import { dropMaterializedView } from '../../../src/operations/materializedViews';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('materializedViews', () => {
    describe('dropMaterializedView', () => {
      const dropMaterializedViewFn = dropMaterializedView(options1);

      it('should return a function', () => {
        expect(dropMaterializedViewFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropMaterializedViewFn('order_summary');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP MATERIALIZED VIEW "order_summary";');
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropMaterializedViewFn('order_summary', {
          ifExists: true,
          cascade: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'DROP MATERIALIZED VIEW IF EXISTS "order_summary" CASCADE;'
        );
      });
    });
  });
});
