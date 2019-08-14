const { expect } = require('chai');
const Indexes = require('../lib/operations/indexes');
const { options } = require('./utils');

describe('lib/operations/indexes', () => {
  describe('.create', () => {
    it('check schema not included in index name', () => {
      const sql = Indexes.createIndex(options)({ schema: 'a', name: 'b' }, [
        'c',
        'd'
      ]);
      expect(sql).to.equal(
        'CREATE  INDEX  "b_c_d_index" ON "a"."b" ("c", "d");'
      );
    });

    it('add opclass option', () => {
      const sql = Indexes.createIndex(options)('x', ['y'], {
        method: 'gist',
        name: 'z',
        opclass: 'some_opclass',
        where: 'some condition'
      });
      expect(sql).to.equal(
        'CREATE  INDEX  "z" ON "x" USING gist ("y" some_opclass) WHERE some condition;'
      );
    });
  });
});
