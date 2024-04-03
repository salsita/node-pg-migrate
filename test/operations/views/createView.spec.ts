import { describe, expect, it } from 'vitest';
import { createView } from '../../../src/operations/views';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('views', () => {
    describe('createView', () => {
      const createViewFn = createView(options1);

      it('should return a function', () => {
        expect(createViewFn).toBeTypeOf('function');
      });

      // TODO @Shinigami92 2024-03-20: This should throw an error
      it.todo('should return sql statement', () => {
        const statement = createViewFn('comedies', {}, '');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('CREATE VIEW "comedies" AS ;');
      });

      it('should return sql statement with viewOptions', () => {
        const statement = createViewFn(
          'comedies',
          {
            ifExists: true,
            cascade: true,
            replace: true,
            recursive: true,
            columns: ['column1', 'column2'],
            options: {
              classification: 'PG',
            },
            checkOption: 'LOCAL',
            temporary: true,
          },
          "SELECT * FROM films WHERE kind = 'Comedy'"
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE OR REPLACE TEMPORARY RECURSIVE VIEW "comedies"("column1", "column2") WITH (classification = PG) AS SELECT * FROM films WHERE kind = \'Comedy\' WITH LOCAL CHECK OPTION;'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = createViewFn(
          { name: 'comedies', schema: 'myschema' },
          {},
          "SELECT * FROM films WHERE kind = 'Comedy'"
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE VIEW "myschema"."comedies" AS SELECT * FROM films WHERE kind = \'Comedy\';'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(createViewFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = createViewFn.reverse(
            'comedies',
            {},
            "SELECT * FROM films WHERE kind = 'Comedy'"
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('DROP VIEW "comedies";');
        });
      });
    });
  });
});
