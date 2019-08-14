const { expect } = require('chai');
const Roles = require('../lib/operations/roles');
const { options } = require('./utils');

describe('lib/operations/roles', () => {
  describe('.create', () => {
    it('check defaults', () => {
      const sql = Roles.createRole(options)('role');
      expect(sql).to.equal(
        'CREATE ROLE "role" WITH NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOLOGIN NOREPLICATION;'
      );
    });
  });
});
