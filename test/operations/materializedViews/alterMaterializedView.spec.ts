import { describe, expect, it } from 'vitest';
import { alterMaterializedView } from '../../../src/operations/materializedViews';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('materializedViews', () => {
    describe('alterMaterializedView', () => {
      const alterMaterializedViewFn = alterMaterializedView(options1);

      it('should return a function', () => {
        expect(alterMaterializedViewFn).toBeTypeOf('function');
      });

      // TODO @Shinigami92 2024-04-02: This should throw an error
      it('should return sql statement', () => {
        const statement = alterMaterializedViewFn('a_mview', {});

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER MATERIALIZED VIEW "a_mview"
  ;`);
      });

      it('should return sql statement with materializedOptions', () => {
        const statement = alterMaterializedViewFn('a_mview', {
          cluster: 'a_cluster',
          extension: 'a_extension',
          storageParameters: {
            fillfactor: 70,
            fillfactor2: 50,
            reset1: null,
            reset2: null,
          },
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `ALTER MATERIALIZED VIEW "a_mview"
  CLUSTER ON "a_cluster",
  DEPENDS ON EXTENSION "a_extension",
  SET (fillfactor = 70, fillfactor2 = 50),
  RESET (reset1, reset2);`
        );
      });

      it('should return sql statement without cluster', () => {
        const statement = alterMaterializedViewFn('a_mview', {
          cluster: null,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `ALTER MATERIALIZED VIEW "a_mview"
  SET WITHOUT CLUSTER;`
        );
      });
    });
  });
});
