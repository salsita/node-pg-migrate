import { expect } from 'chai';
import * as Indexes from '../lib/operations/indexes';

describe('lib/operations/indexes', () => {
  describe('.create', () => {
    it('check schema not included in index name', () => {
      const sql = Indexes.create({ schema: 'a', name: 'b' }, ['c', 'd']);
      expect(sql).to.equal('CREATE  INDEX  "b_c_d_index" ON "a"."b" ("c", "d");');
    });
  });
});
