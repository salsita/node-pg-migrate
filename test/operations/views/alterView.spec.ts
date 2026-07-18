import { describe, expect, it } from 'vitest';
import { alterView } from '../../../src/operations/views';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('views', () => {
    describe('alterView', () => {
      const alterViewFn = alterView(options1);

      it('should return a function', () => {
        expect(alterViewFn).toBeTypeOf('function');
      });

      it('should throw an error for empty options', () => {
        expect(() => alterViewFn('a_view', {})).toThrow(
          new Error('No options provided for alterView')
        );
      });

      it('should return sql statement with viewOptions', () => {
        const statement = alterViewFn('a_view', {
          checkOption: 'LOCAL',
          options: {
            classification: 'PG',
          },
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER VIEW "a_view" SET (classification = PG, check_option = LOCAL);'
        );
      });

      it('should return sql statement with options containing null value', () => {
        const statement = alterViewFn('a_view', {
          checkOption: 'LOCAL',
          options: {
            classification: null,
          },
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `ALTER VIEW "a_view" SET (check_option = LOCAL);
ALTER VIEW "a_view" RESET (classification);`
        );
      });

      it('should throw error on duplicate checkOption', () => {
        expect(() =>
          alterViewFn('a_view', {
            checkOption: 'LOCAL',
            options: {
              check_option: 'CASCADED',
            },
          })
        ).toThrow(
          new Error(
            '"options.check_option" and "checkOption" can\'t be specified together'
          )
        );
      });
    });
  });
});
