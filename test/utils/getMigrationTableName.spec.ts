import { describe, expect, it } from 'vitest';
import type { RunnerOption } from '../../src';
import { getMigrationTableName } from '../../src/utils';

describe('utils', () => {
  describe('getMigrationTableName', () => {
    const defaults: RunnerOption = {
      databaseUrl: 'postgres://localhost:5432/db',
      dir: 'migrations',
      direction: 'up',
      migrationsTable: 'pgmigrations',
    };

    it('should qualify the table with its schema', () => {
      expect(
        getMigrationTableName({ ...defaults, schema: ['app', 'public'] })
      ).toBe('"app"."pgmigrations"');
    });

    it('should qualify the table with another schema when given one', () => {
      expect(getMigrationTableName(defaults, 'tenant_a')).toBe(
        '"tenant_a"."pgmigrations"'
      );
    });

    it('should use the configured names as they are, even under decamelize', () => {
      expect(
        getMigrationTableName({
          ...defaults,
          migrationsSchema: 'myApp',
          migrationsTable: 'pgMigrations',
          decamelize: true,
        })
      ).toBe('"myApp"."pgMigrations"');
    });

    it('should escape quotes in the names', () => {
      expect(
        getMigrationTableName({ ...defaults, migrationsTable: 'my"table' })
      ).toBe('"public"."my""table"');
    });
  });
});
