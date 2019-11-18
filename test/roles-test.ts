import { expect } from 'chai'
import * as Roles from '../src/operations/roles'
import { options1, options2 } from './utils'

describe('lib/operations/roles', () => {
  describe('.create', () => {
    it('check defaults', () => {
      const sql1 = Roles.createRole(options1)('roleTest')
      const sql2 = Roles.createRole(options2)('roleTest')
      expect(sql1).to.equal(
        'CREATE ROLE "roleTest" WITH NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOLOGIN NOREPLICATION;',
      )
      expect(sql2).to.equal(
        'CREATE ROLE "role_test" WITH NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOLOGIN NOREPLICATION;',
      )
    })
  })
})
