import { describe, expect, it } from 'vitest';
import { PgType } from '../../../src';
import { setTypeAttribute } from '../../../src/operations/types';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('types', () => {
    describe('setTypeAttribute', () => {
      const setTypeAttributeFn = setTypeAttribute(options1);

      it('should return a function', () => {
        expect(setTypeAttributeFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = setTypeAttributeFn('compfoo', 'f3', PgType.INT);

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TYPE "compfoo" ALTER ATTRIBUTE "f3" SET DATA TYPE integer;'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = setTypeAttributeFn(
          { name: 'compfoo', schema: 'myschema' },
          'f3',
          'int'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TYPE "myschema"."compfoo" ALTER ATTRIBUTE "f3" SET DATA TYPE integer;'
        );
      });
    });
  });
});
