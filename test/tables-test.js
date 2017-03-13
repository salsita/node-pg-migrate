import assert from 'assert';
import * as Tables from '../dist/operations/tables';

describe('lib/operations/tables', () => {
  describe('.create', () => {
    it('check schemas can be used', () => {
      const sql = Tables.create({ schema: 'my_schema', name: 'my_table_name' }, { id: 'serial' });
      assert.equal(sql, `CREATE TABLE "my_schema"."my_table_name" (
  "id" serial
);`);
    });
  });
});
