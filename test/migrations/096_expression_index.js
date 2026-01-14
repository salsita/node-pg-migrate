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
  pgm.createIndex('pgm_users', "meta->'id'", {
    name: 'pgm_users_meta_id_json_operator_idx',
  });
  pgm.createIndex('pgm_users', "meta->>'id'", {
    name: 'pgm_users_meta_id_text_operator_idx',
  });
  pgm.createIndex('pgm_users', "meta#>'{a,b}'", {
    name: 'pgm_users_meta_path_json_operator_idx',
  });
  pgm.createIndex('pgm_users', "meta#>>'{a,b}'", {
    name: 'pgm_users_meta_path_text_operator_idx',
  });
  pgm.createIndex('pgm_users', 'meta @> \'{"id": 1}\'::jsonb', {
    name: 'pgm_users_meta_contains_operator_idx',
  });
  pgm.createIndex('pgm_users', 'meta <@ \'{"id": 1, "x": 2}\'::jsonb', {
    name: 'pgm_users_meta_contained_operator_idx',
  });
  pgm.createIndex('pgm_users', "meta ? 'id'", {
    name: 'pgm_users_meta_has_key_operator_idx',
  });
  pgm.createIndex('pgm_users', "meta ?| array['id','x']", {
    name: 'pgm_users_meta_has_any_operator_idx',
  });
  pgm.createIndex('pgm_users', "meta ?& array['id','x']", {
    name: 'pgm_users_meta_has_all_operator_idx',
  });
  pgm.createIndex('pgm_users', 'meta || \'{"x": 2}\'::jsonb', {
    name: 'pgm_users_meta_concat_operator_idx',
  });
  pgm.createIndex('pgm_users', "meta - 'id'", {
    name: 'pgm_users_meta_remove_key_operator_idx',
  });
  pgm.createIndex('pgm_users', "meta #- '{a,b}'", {
    name: 'pgm_users_meta_remove_path_operator_idx',
  });
  pgm.createIndex('pgm_users', "meta @? '$.id ? (@ == 1)'", {
    name: 'pgm_users_meta_path_exists_operator_idx',
  });
  pgm.createIndex('pgm_users', "meta @@ '$.id == 1'", {
    name: 'pgm_users_meta_path_predicate_operator_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('pgm_users', "meta->'id'", {
    name: 'pgm_users_meta_id_json_operator_idx',
  });
  pgm.dropIndex('pgm_users', "meta->>'id'", {
    name: 'pgm_users_meta_id_text_operator_idx',
  });
  pgm.dropIndex('pgm_users', "meta#>'{a,b}'", {
    name: 'pgm_users_meta_path_json_operator_idx',
  });
  pgm.dropIndex('pgm_users', "meta#>>'{a,b}'", {
    name: 'pgm_users_meta_path_text_operator_idx',
  });

  pgm.dropIndex('pgm_users', 'meta @> \'{"id": 1}\'::jsonb', {
    name: 'pgm_users_meta_contains_operator_idx',
  });
  pgm.dropIndex('pgm_users', 'meta <@ \'{"id": 1, "x": 2}\'::jsonb', {
    name: 'pgm_users_meta_contained_operator_idx',
  });
  pgm.dropIndex('pgm_users', "meta ? 'id'", {
    name: 'pgm_users_meta_has_key_operator_idx',
  });
  pgm.dropIndex('pgm_users', "meta ?| array['id','x']", {
    name: 'pgm_users_meta_has_any_operator_idx',
  });
  pgm.dropIndex('pgm_users', "meta ?& array['id','x']", {
    name: 'pgm_users_meta_has_all_operator_idx',
  });
  pgm.dropIndex('pgm_users', 'meta || \'{"x": 2}\'::jsonb', {
    name: 'pgm_users_meta_concat_operator_idx',
  });
  pgm.dropIndex('pgm_users', "meta - 'id'", {
    name: 'pgm_users_meta_remove_key_operator_idx',
  });
  pgm.dropIndex('pgm_users', "meta #- '{a,b}'", {
    name: 'pgm_users_meta_remove_path_operator_idx',
  });

  pgm.dropIndex('pgm_users', "meta @? '$.id ? (@ == 1)'", {
    name: 'pgm_users_meta_path_exists_operator_idx',
  });
  pgm.dropIndex('pgm_users', "meta @@ '$.id == 1'", {
    name: 'pgm_users_meta_path_predicate_operator_idx',
  });

  pgm.dropTable('pgm_users');
};
