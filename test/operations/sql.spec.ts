import { describe, expect, it } from 'vitest';
import { sql } from '../../src/operations/sql';
import { options1 } from '../presetMigrationOptions';

describe('operations', () => {
  describe('sql', () => {
    const sqlFn = sql(options1);

    it('should return a function', () => {
      expect(sqlFn).toBeTypeOf('function');
    });

    it('should return sql statement', () => {
      const statement = sqlFn('SELECT * FROM users WHERE id = {id}', {
        id: 1,
      });

      expect(statement).toBeTypeOf('string');
      expect(statement).toBe('SELECT * FROM users WHERE id = 1;');
    });
  });
});
