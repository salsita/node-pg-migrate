import { describe, expect, it } from 'vitest';
import { PgType } from '../../../src';
import { addTypeAttribute } from '../../../src/operations/types';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('types', () => {
    describe('addTypeAttribute', () => {
      const addTypeAttributeFn = addTypeAttribute(options1);

      it('should return a function', () => {
        expect(addTypeAttributeFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = addTypeAttributeFn('compfoo', 'f3', PgType.INT);

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TYPE "compfoo" ADD ATTRIBUTE "f3" integer;'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = addTypeAttributeFn(
          { name: 'compfoo', schema: 'myschema' },
          'f3',
          'int'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TYPE "myschema"."compfoo" ADD ATTRIBUTE "f3" integer;'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(addTypeAttributeFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = addTypeAttributeFn.reverse(
            'compfoo',
            'f3',
            PgType.INT
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('ALTER TYPE "compfoo" DROP ATTRIBUTE "f3";');
        });
      });
    });
  });
});
