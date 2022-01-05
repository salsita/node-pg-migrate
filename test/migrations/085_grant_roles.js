exports.up = (pgm) => {
  pgm.grantRoles(['role1', 'role2'], 'role3')
}
