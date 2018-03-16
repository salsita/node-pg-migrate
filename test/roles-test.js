import { expect } from 'chai';
import * as Roles from '../lib/operations/roles';

describe('lib/operations/roles', () => {
  describe('.create', () => {
    it('check defaults', () => {
      const sql = Roles.create('role');
      expect(sql).to.equal('CREATE ROLE "role" WITH NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOLOGIN NOREPLICATION;');
    });
  });
});
