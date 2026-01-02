exports.up = (pgm) => {
  pgm.createTable('users', {
    id: 'id',
    email: 'text',
    meta: 'jsonb',
    created_at: 'timestamp',
    score: 'integer',
  });

  pgm.createIndex('users', 'email');
  pgm.createIndex('users', "meta->>'type'", { name: 'users_meta_type_idx' });
  pgm.createIndex('users', 'lower(email)', { name: 'users_email_lower_idx' });
  pgm.createIndex('users', 'created_at::date', {
    name: 'users_created_date_idx',
  });
  pgm.createIndex('users', 'score * 10', { name: 'users_score_idx' });
  pgm.createIndex('users', ['id', "meta->>'type'"], {
    name: 'users_id_meta_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('users');
};
