import { expect } from 'chai'
import * as Grants from '../src/operations/grants'
import { options1 } from './utils'

type GrantRolesParameters = Parameters<ReturnType<typeof Grants.grantRoles>>

describe('lib/operations/grants', () => {
  describe('.grantRoles', () => {
    it('grants correct roles', () => {
      const args: GrantRolesParameters = ['role1', 'role2']
      const sql1 = Grants.grantRoles(options1)(...args)
      expect(sql1).to.equal(`GRANT "role1" TO "role2";`)
    })
  })
})
