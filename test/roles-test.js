const { expect } = require('chai');
const Roles = require('../lib/operations/roles');

describe('lib/operations/roles', () => {
  describe('.create', () => {
    it('check defaults', () => {
      const sql = Roles.createRole('role');
      expect(sql).to.equal(
        'CREATE ROLE "role" WITH NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOLOGIN NOREPLICATION;'
      );
    });
  });
});
