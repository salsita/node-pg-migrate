import { expect } from 'chai';
import * as Tables from '../lib/operations/tables';

describe('lib/operations/tables', () => {
  describe('.create', () => {
    it('check schemas can be used', () => {
      const sql = Tables.create()({ schema: 'my_schema', name: 'my_table_name' }, { id: 'serial' });
      expect(sql).to.equal(`CREATE TABLE "my_schema"."my_table_name" (
  "id" serial
);`);
    });

    it('check shorthands work', () => {
      const sql = Tables.create()('my_table_name', { id: 'id' });
      expect(sql).to.equal(`CREATE TABLE "my_table_name" (
  "id" serial PRIMARY KEY
);`);
    });

    it('check custom shorthands can be used', () => {
      const sql = Tables.create({ id: { type: 'uuid', primaryKey: true } })('my_table_name', { id: 'id' });
      expect(sql).to.equal(`CREATE TABLE "my_table_name" (
  "id" uuid PRIMARY KEY
);`);
    });
  });
});
