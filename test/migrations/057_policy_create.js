const schema = process.env.SCHEMA || 'public'

exports.up = (pgm) => {
  pgm.createTable('tp', {
    user_name: 'varchar(20)',
  })
  pgm.alterTable('tp', {
    levelSecurity: 'enable',
  })
  pgm.createRole('admin')
  pgm.createRole('alice')
  pgm.createPolicy('tp', 'p', {
    role: 'admin',
    using: 'true',
    check: 'true',
  })
  pgm.renamePolicy('tp', 'p', 'admin_policy')
  pgm.createPolicy('tp', 'user_select_policy', {
    command: 'SELECT',
    using: 'current_user = user_name',
  })
  pgm.createPolicy('tp', 'user_update_policy', {
    command: 'UPDATE',
    using: 'current_user = user_name',
    check: 'current_user = user_name',
  })
  pgm.sql(`GRANT USAGE ON SCHEMA "${schema}" TO PUBLIC`)
  pgm.sql('GRANT ALL ON "tp" TO PUBLIC')
}

exports.down = (pgm) => {
  pgm.dropPolicy('tp', 'admin_policy')
  pgm.dropPolicy('tp', 'user_select_policy')
  pgm.dropPolicy('tp', 'user_update_policy')
  pgm.dropTable('tp')
  pgm.dropRole('admin')
  pgm.dropRole('alice')
}
