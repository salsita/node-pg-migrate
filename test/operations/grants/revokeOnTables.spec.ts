import { describe, expect, it } from 'vitest';
import type { Name, RevokeOnTablesOptions } from '../../../src';
import { revokeOnTables } from '../../../src/operations/grants';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('grants', () => {
    describe('revokeOnTables', () => {
      const revokeOnTablesFn = revokeOnTables(options1);

      it('should return a function', () => {
        expect(revokeOnTablesFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = revokeOnTablesFn({
          tables: 'films',
          privileges: 'INSERT',
          roles: 'PUBLIC',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('REVOKE INSERT ON "films" FROM PUBLIC;');
      });

      it('should return sql statement with dropOptions', () => {
        const statement = revokeOnTablesFn({
          tables: 'films',
          privileges: ['DELETE', 'UPDATE'],
          roles: 'PUBLIC',
          cascade: true,
          onlyGrantOption: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'REVOKE GRANT OPTION FOR DELETE, UPDATE ON "films" FROM PUBLIC CASCADE;'
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
          const revokeOptions: RevokeOnTablesOptions & { schema: string } = {
            tables,
            schema: 'other_schema',
            privileges: ['SELECT', 'UPDATE'],
            roles: ['app"role', 'PUBLIC'],
            onlyGrantOption: true,
            cascade: true,
          };

          expect(revokeOnTablesFn(revokeOptions)).toBe(
            `REVOKE GRANT OPTION FOR SELECT, UPDATE ON ${sql} FROM "app""role", PUBLIC CASCADE;`
          );
        }
      );

      it('preserves revocation on all tables in a quoted schema', () => {
        expect(
          revokeOnTablesFn({
            tables: 'ALL',
            schema: 'app"schema',
            privileges: 'ALL',
            roles: 'reader',
            onlyGrantOption: true,
            cascade: true,
          })
        ).toBe(
          'REVOKE GRANT OPTION FOR ALL ON ALL TABLES IN SCHEMA "app""schema" FROM "reader" CASCADE;'
        );
      });

      it('preserves the literal ALL name without a schema', () => {
        expect(
          revokeOnTablesFn({
            tables: 'ALL',
            privileges: 'SELECT',
            roles: 'reader',
          })
        ).toBe('REVOKE SELECT ON "ALL" FROM "reader";');
      });
    });
  });
});
