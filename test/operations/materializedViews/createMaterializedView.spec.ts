import { describe, expect, it } from 'vitest';
import { createMaterializedView } from '../../../src/operations/materializedViews';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('materializedViews', () => {
    describe('createMaterializedView', () => {
      const createMaterializedViewFn = createMaterializedView(options1);

      it('should return a function', () => {
        expect(createMaterializedViewFn).toBeTypeOf('function');
      });

      // TODO @Shinigami92 2024-04-02: This should throw an error
      it.todo('should return sql statement', () => {
        const statement = createMaterializedViewFn('order_summary', {}, '');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('CREATE MATERIALIZED VIEW "order_summary" AS ;');
      });

      it('should return sql statement with materializedViewOptions', () => {
        const statement = createMaterializedViewFn(
          'comedies',
          {},
          "SELECT * FROM films WHERE kind = 'Comedy'"
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE MATERIALIZED VIEW "comedies" AS SELECT * FROM films WHERE kind = \'Comedy\';'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = createMaterializedViewFn(
          { name: 'comedies', schema: 'myschema' },
          {
            ifNotExists: true,
            columns: 'kind',
            storageParameters: { fillfactor: 70 },
            tablespace: 'mytablespace',
            data: true,
            // TODO @Shinigami92 2024-04-02: Remove these from the options interface
            // ifExists: true,
            // cascade: true,
          },
          "SELECT * FROM films WHERE kind = 'Comedy'"
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE MATERIALIZED VIEW IF NOT EXISTS "myschema"."comedies"("kind") WITH (fillfactor = 70) TABLESPACE "mytablespace" AS SELECT * FROM films WHERE kind = \'Comedy\' WITH DATA;'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(createMaterializedViewFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = createMaterializedViewFn.reverse(
            { name: 'comedies', schema: 'myschema' },
            {},
            "SELECT * FROM films WHERE kind = 'Comedy'"
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'DROP MATERIALIZED VIEW "myschema"."comedies";'
          );
        });
      });
    });
  });
});
