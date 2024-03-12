import { describe, expect, it } from 'vitest';
import { dropTable } from '../../../src/operations/tables';
import { options1 } from '../../utils';

describe('operations', () => {
  describe('tables', () => {
    describe('dropTable', () => {
      const dropTableFn = dropTable(options1);

      it('should return a function', () => {
        expect(dropTableFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropTableFn('films');

        expect(statement).toBeTypeOf('string');
        expect(statement).toStrictEqual('DROP TABLE "films";');
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropTableFn('films', {
          ifExists: true,
          cascade: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toStrictEqual(
          'DROP TABLE IF EXISTS "films" CASCADE;'
        );
      });
    });
  });
});
