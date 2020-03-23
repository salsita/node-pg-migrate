const domain = require('./046_domain_create_rename')

exports.up = (pgm) => {
  pgm.dropTable('td')
  pgm.dropDomain('dom')
}

exports.down = domain.up
