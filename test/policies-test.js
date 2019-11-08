const { expect } = require('chai');
const Policies = require('../lib/operations/policies');
const { options1, options2 } = require('./utils');

describe('lib/operations/policies', () => {
  describe('.create', () => {
    it('check defaults', () => {
      const args = [{ schema: 'mySchema', name: 'myTableName' }, 'getIn'];
      const sql1 = Policies.createPolicy(options1)(...args);
      const sql2 = Policies.createPolicy(options2)(...args);
      expect(sql1).to.equal(
        'CREATE POLICY "getIn" ON "mySchema"."myTableName" FOR ALL TO PUBLIC;'
      );
      expect(sql2).to.equal(
        'CREATE POLICY "get_in" ON "my_schema"."my_table_name" FOR ALL TO PUBLIC;'
      );
    });
    it('can be restrictive', () => {
      const args = [
        { schema: 'my_schema', name: 'my_tablename' },
        'get_out',
        { restrictive: true }
      ];
      const sql1 = Policies.createPolicy(options1)(...args);
      const sql2 = Policies.createPolicy(options2)(...args);
      expect(sql1).to.equal(
        'CREATE POLICY "get_out" ON "my_schema"."my_tablename" AS RESTRICTIVE FOR ALL TO PUBLIC;'
      );
      expect(sql2).to.equal(
        'CREATE POLICY "get_out" ON "my_schema"."my_tablename" AS RESTRICTIVE FOR ALL TO PUBLIC;'
      );
    });
    it('supports all options', () => {
      const args = [
        'my_tablename',
        'my_allowance',
        {
          restrictive: false,
          command: 'UPDATE',
          role: 'the_user',
          using: 'crazy_expression',
          check: 'curious.function(column)'
        }
      ];
      const sql = Policies.createPolicy(options1)(...args);
      expect(sql).to.equal(
        'CREATE POLICY "my_allowance" ON "my_tablename" AS PERMISSIVE FOR UPDATE TO the_user USING (crazy_expression) WITH CHECK (curious.function(column));'
      );
    });
  });
});
