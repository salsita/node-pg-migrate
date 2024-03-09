import { describe, expect, it } from 'vitest';
import { sql } from '../../src/operations/other';
import { options1 } from '../utils';

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
      expect(statement).toStrictEqual('SELECT * FROM users WHERE id = 1;');
    });
  });
});
