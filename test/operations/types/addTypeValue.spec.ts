import { describe, expect, it } from 'vitest';
import { addTypeValue } from '../../../src/operations/types';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('types', () => {
    describe('addTypeValue', () => {
      const addTypeValueFn = addTypeValue(options1);

      it('should return a function', () => {
        expect(addTypeValueFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = addTypeValueFn('colors', 'purple');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TYPE "colors" ADD VALUE $pga$purple$pga$;'
        );
      });

      it('should return sql statement with typeValueOptions', () => {
        const statement = addTypeValueFn('colors', 'purple', {
          after: 'red',
          ifNotExists: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TYPE "colors" ADD VALUE IF NOT EXISTS $pga$purple$pga$ AFTER $pga$red$pga$;'
        );

        const statement2 = addTypeValueFn('colors', 'purple', {
          before: 'yellow',
          ifNotExists: true,
        });

        expect(statement2).toBeTypeOf('string');
        expect(statement2).toBe(
          'ALTER TYPE "colors" ADD VALUE IF NOT EXISTS $pga$purple$pga$ BEFORE $pga$yellow$pga$;'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = addTypeValueFn(
          { name: 'colors', schema: 'myschema' },
          'purple'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TYPE "myschema"."colors" ADD VALUE $pga$purple$pga$;'
        );
      });

      it('should throw when before and after are specified together', () => {
        expect(() =>
          addTypeValueFn('colors', 'purple', {
            before: 'blue',
            after: 'red',
          })
        ).toThrow(
          new Error('"before" and "after" can\'t be specified together')
        );
      });
    });
  });
});
