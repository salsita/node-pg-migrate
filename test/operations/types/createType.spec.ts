import { describe, expect, it } from 'vitest';
import { PgType } from '../../../src';
import { createType } from '../../../src/operations/types';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('types', () => {
    describe('createType', () => {
      const createTypeFn = createType(options1);

      it('should return a function', () => {
        expect(createTypeFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = createTypeFn('compfoo', {
          f1: 'int',
          f2: PgType.TEXT,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`CREATE TYPE "compfoo" AS (
"f1" integer,
"f2" text
);`);
      });

      // TODO @Shinigami92 2024-03-18: The typeOptions are buggy
      it.todo('should return sql statement with typeOptions');

      it('should return sql statement with schema', () => {
        const statement = createTypeFn(
          {
            name: 'box',
            schema: 'myschema',
          },
          ['cstring']
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE TYPE "myschema"."box" AS ENUM ($pga$cstring$pga$);'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(createTypeFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = createTypeFn.reverse('compfoo', {
            f1: 'int',
            f2: PgType.TEXT,
          });

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('DROP TYPE "compfoo";');
        });
      });
    });
  });
});
