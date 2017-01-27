var Tables = require('../lib/operations/tables');
var assert = require('assert');

describe('lib/operations/tables', function() {
  describe('.create', function() {
    it('check schemas can be used', function() {
      var sql = Tables.create({ schema: 'my_schema', name: 'my_table_name' }, { id: 'serial' });
      assert.equal(sql, 'CREATE TABLE "my_schema"."my_table_name" (\n\
  "id" serial\n\
);');
    });
  });
});
