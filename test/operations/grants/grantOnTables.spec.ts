import { describe, expect, it } from 'vitest';
import type { GrantOnTablesOptions, Name } from '../../../src';
import { grantOnTables } from '../../../src/operations/grants';
import { options1, options2 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('grants', () => {
    describe('grantOnTables', () => {
      const grantOnTablesFn = grantOnTables(options1);

      it('should return a function', () => {
        expect(grantOnTablesFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = grantOnTablesFn({
          tables: 'films',
          privileges: 'INSERT',
          roles: 'PUBLIC',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('GRANT INSERT ON "films" TO PUBLIC;');
      });

      it('should return sql statement with grantsOptions', () => {
        const statement = grantOnTablesFn({
          tables: 'films',
          privileges: ['DELETE', 'UPDATE'],
          roles: 'PUBLIC',
          cascade: true,
          withGrantOption: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'GRANT DELETE, UPDATE ON "films" TO PUBLIC WITH GRANT OPTION;'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = grantOnTablesFn({
          tables: { name: 'films', schema: 'myschema' },
          privileges: 'INSERT',
          roles: { name: 'PUBLIC', schema: 'myschema' },
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'GRANT INSERT ON "myschema"."films" TO "myschema"."PUBLIC";'
        );
      });

      it.each<{ tables: Name | Name[]; sql: string }>([
        { tables: 'films', sql: '"films"' },
        { tables: 'fi"lms', sql: '"fi""lms"' },
        {
          tables: { schema: 'app"schema', name: 'fi"lms' },
          sql: '"app""schema"."fi""lms"',
        },
        {
          tables: [
            { schema: 'app"schema', name: 'fi"lms' },
            'other"films',
            'ALL',
          ],
          sql: '"app""schema"."fi""lms", "other""films", "ALL"',
        },
        { tables: { name: 'ALL' }, sql: '"ALL"' },
      ])(
        'preserves named selection $sql with an extra schema',
        ({ tables, sql }) => {
          const grantOptions: GrantOnTablesOptions & { schema: string } = {
            tables,
            schema: 'other_schema',
            privileges: ['SELECT', 'UPDATE'],
            roles: ['app"role', 'PUBLIC'],
            withGrantOption: true,
            onlyGrantOption: true,
            cascade: true,
          };

          expect(grantOnTablesFn(grantOptions)).toBe(
            `GRANT SELECT, UPDATE ON ${sql} TO "app""role", PUBLIC WITH GRANT OPTION;`
          );
          expect(grantOnTablesFn.reverse(grantOptions)).toBe(
            `REVOKE GRANT OPTION FOR SELECT, UPDATE ON ${sql} FROM "app""role", PUBLIC CASCADE;`
          );
        }
      );

      it('preserves grants and reversal on all tables in a quoted schema', () => {
        const grantOptions: GrantOnTablesOptions = {
          tables: 'ALL',
          schema: 'app"schema',
          privileges: 'ALL',
          roles: 'PUBLIC',
        };

        expect(grantOnTablesFn(grantOptions)).toBe(
          'GRANT ALL ON ALL TABLES IN SCHEMA "app""schema" TO PUBLIC;'
        );
        expect(grantOnTablesFn.reverse(grantOptions)).toBe(
          'REVOKE ALL ON ALL TABLES IN SCHEMA "app""schema" FROM PUBLIC;'
        );
      });

      it.each([{}, { schema: undefined }])(
        'rejects bare ALL without a schema (%j), including reversal',
        (schemaOptions) => {
          const grantOptions: GrantOnTablesOptions = {
            tables: 'ALL',
            privileges: 'SELECT',
            roles: 'reader',
            ...schemaOptions,
          };
          const error = new Error(
            'The "schema" option is required when "tables" is "ALL"'
          );

          expect(() => grantOnTablesFn(grantOptions)).toThrow(error);
          expect(() => grantOnTablesFn.reverse(grantOptions)).toThrow(error);
        }
      );

      it.each([{}, { schema: 'other_schema' }])(
        'preserves explicit ALL names and literal arrays (%j), including reversal',
        (schemaOptions) => {
          const selections: Array<{ tables: Name | Name[]; sql: string }> = [
            { tables: { name: 'ALL' }, sql: '"ALL"' },
            {
              tables: { schema: 'app"schema', name: 'ALL' },
              sql: '"app""schema"."ALL"',
            },
            // Arrays are named selections, even with one element named ALL.
            { tables: ['ALL'], sql: '"ALL"' },
            { tables: ['ALL', 'foo'], sql: '"ALL", "foo"' },
          ];

          for (const { tables, sql } of selections) {
            const grantOptions: GrantOnTablesOptions = {
              tables,
              privileges: 'SELECT',
              roles: 'reader',
              ...schemaOptions,
            };

            expect(grantOnTablesFn(grantOptions)).toBe(
              `GRANT SELECT ON ${sql} TO "reader";`
            );
            expect(grantOnTablesFn.reverse(grantOptions)).toBe(
              `REVOKE SELECT ON ${sql} FROM "reader";`
            );
          }
        }
      );

      it('uses configured identifier rendering for named selections with an extra schema', () => {
        const grantOptions = {
          tables: { schema: 'appSchema', name: 'filmRecords' },
          schema: 'otherSchema',
          privileges: 'SELECT' as const,
          roles: 'appRole',
        };

        expect(grantOnTables(options2)(grantOptions)).toBe(
          'GRANT SELECT ON "app_schema"."film_records" TO "app_role";'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(grantOnTablesFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = grantOnTablesFn.reverse({
            tables: 'films',
            privileges: 'INSERT',
            roles: 'PUBLIC',
          });

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('REVOKE INSERT ON "films" FROM PUBLIC;');
        });
      });
    });
  });
});
