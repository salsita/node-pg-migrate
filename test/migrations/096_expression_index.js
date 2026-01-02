exports.up = (pgm) => {
  pgm.createTable('pgm_users', {
    id: 'id',
    email: 'text',
    meta: 'jsonb',
    created_at: 'timestamp',
    score: 'integer',
  });

  pgm.createIndex('pgm_users', 'email');
  pgm.createIndex('pgm_users', "meta->>'type'", {
    name: 'pgm_users_meta_type_idx',
  });
  pgm.createIndex('pgm_users', 'lower(email)', {
    name: 'pgm_users_email_lower_idx',
  });
  pgm.createIndex('pgm_users', 'created_at::date', {
    name: 'pgm_users_created_date_idx',
  });
  pgm.createIndex('pgm_users', 'score * 10', { name: 'pgm_users_score_idx' });
  pgm.createIndex('pgm_users', ['id', "meta->>'type'"], {
    name: 'pgm_users_id_meta_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('pgm_users');
};
