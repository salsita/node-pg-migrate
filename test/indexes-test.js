const { expect } = require('chai');
const Indexes = require('../lib/operations/indexes');
const { options1, options2 } = require('./utils');

describe('lib/operations/indexes', () => {
  describe('.create', () => {
    it('check schema not included in index name', () => {
      const args = [{ schema: 'mySchema', name: 'myTable' }, ['colA', 'colB']];
      const sql1 = Indexes.createIndex(options1)(...args);
      const sql2 = Indexes.createIndex(options2)(...args);
      expect(sql1).to.equal(
        'CREATE  INDEX  "myTable_colA_colB_index" ON "mySchema"."myTable" ("colA", "colB");'
      );
      expect(sql2).to.equal(
        'CREATE  INDEX  "my_table_col_a_col_b_index" ON "my_schema"."my_table" ("col_a", "col_b");'
      );
    });

    it('add opclass option', () => {
      const args = [
        'xTable',
        ['yName'],
        {
          method: 'gist',
          name: 'zIndex',
          opclass: 'someOpclass',
          where: 'some condition'
        }
      ];
      const sql1 = Indexes.createIndex(options1)(...args);
      const sql2 = Indexes.createIndex(options2)(...args);
      expect(sql1).to.equal(
        'CREATE  INDEX  "zIndex" ON "xTable" USING gist ("yName" someOpclass) WHERE some condition;'
      );
      expect(sql2).to.equal(
        'CREATE  INDEX  "z_index" ON "x_table" USING gist ("y_name" some_opclass) WHERE some condition;'
      );
    });
  });
});
