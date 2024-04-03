import { describe, expect, it } from 'vitest';
import { alterTable } from '../../../src/operations/tables';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('tables', () => {
    describe('alterTable', () => {
      const alterTableFn = alterTable(options1);

      it('should return a function', () => {
        expect(alterTableFn).toBeTypeOf('function');
      });

      // TODO @Shinigami92 2024-03-11: This should throw an error
      it('should return sql statement', () => {
        const statement = alterTableFn(
          'films',
          // @ts-expect-error: add runtime error
          {}
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER TABLE "films"
    ;`);
      });

      it('should return sql statement with tableOptions', () => {
        const statement = alterTableFn('distributors', {
          levelSecurity: 'ENABLE',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER TABLE "distributors"
    ENABLE ROW LEVEL SECURITY;`);
      });
    });
  });
});
