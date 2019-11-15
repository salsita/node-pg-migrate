import { expect } from 'chai';
import * as Indexes from '../src/operations/indexes';
import { options1, options2 } from './utils';

describe('lib/operations/indexes', () => {
  describe('.create', () => {
    it('check schema not included in index name', () => {
      [
        [
          Indexes.createIndex(options1),
          'CREATE  INDEX  "myTable_colA_colB_index" ON "mySchema"."myTable" ("colA", "colB");',
        ],
        [
          Indexes.createIndex(options2),
          'CREATE  INDEX  "my_table_col_a_col_b_index" ON "my_schema"."my_table" ("col_a", "col_b");',
        ],
      ].forEach(([fn, res]: [ReturnType<typeof Indexes.createIndex>, string]) => {
        expect(fn({ schema: 'mySchema', name: 'myTable' }, ['colA', 'colB'])).to.equal(res)
      })
    });

    it('add opclass option', () => {
      [
        [
          Indexes.createIndex(options1),
          'CREATE  INDEX  "zIndex" ON "xTable" USING gist ("yName" someOpclass) WHERE some condition;',
        ],
        [
          Indexes.createIndex(options2),
          'CREATE  INDEX  "z_index" ON "x_table" USING gist ("y_name" some_opclass) WHERE some condition;',
        ],
      ].forEach(([fn, res]: [ReturnType<typeof Indexes.createIndex>, string]) => {
        expect(fn(
          'xTable',
          ['yName'],
          {
            method: 'gist',
            name: 'zIndex',
            opclass: 'someOpclass',
            where: 'some condition'
          }
        )).to.equal(res)
      })
    });
  });
});
