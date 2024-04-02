import { describe, expect, it } from 'vitest';
import { PgType } from '../../../src';
import { createTable } from '../../../src/operations/tables';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('tables', () => {
    describe('createTable', () => {
      const createTableFn = createTable(options1);

      it('should return a function', () => {
        expect(createTableFn).toBeTypeOf('function');
      });

      // TODO @Shinigami92 2024-03-12: This should throw an error when columns are empty
      it('should return sql statement', () => {
        const statement = createTableFn('films', {});

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('CREATE TABLE "films" (\n  \n);');
      });

      it('should return sql statement with tableOptions', () => {
        const statement = createTableFn('films', {
          code: {
            type: 'char(5)',
            primaryKey: true,
          },
          title: {
            type: 'varchar(40)',
            notNull: true,
          },
          did: {
            type: PgType.INTEGER,
            notNull: true,
          },
          date_prod: PgType.DATE,
          kind: 'varchar(10)',
          len: {
            type: 'interval hour to minute',
          },
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `CREATE TABLE "films" (
  "code" char(5) PRIMARY KEY,
  "title" varchar(40) NOT NULL,
  "did" integer NOT NULL,
  "date_prod" date,
  "kind" varchar(10),
  "len" interval hour to minute
);`
        );
      });

      // TODO @Shinigami92 2024-03-12: This should throw an error when columns are empty
      it('should return sql statement with schema', () => {
        const statement = createTableFn(
          {
            name: 'films',
            schema: 'myschema',
          },
          {}
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('CREATE TABLE "myschema"."films" (\n  \n);');
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(createTableFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = createTableFn.reverse('films', {});

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('DROP TABLE "films";');
        });
      });
    });
  });
});
