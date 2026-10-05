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

      it('preserves the literal ALL name without a schema', () => {
        const grantOptions: GrantOnTablesOptions = {
          tables: 'ALL',
          privileges: 'SELECT',
          roles: 'reader',
        };

        expect(grantOnTablesFn(grantOptions)).toBe(
          'GRANT SELECT ON "ALL" TO "reader";'
        );
        expect(grantOnTablesFn.reverse(grantOptions)).toBe(
          'REVOKE SELECT ON "ALL" FROM "reader";'
        );
      });

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
