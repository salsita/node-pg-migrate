export const up = (pgm) => {
  pgm.createTable('t100', {
    id: 'integer',
    payload: 'text',
    tags: 'text[]',
    location: 'point',
  });
  pgm.createIndex('t100', 'id', {
    include: 'payload',
    where: 'id > 0',
    storageParameters: { fillfactor: 70, deduplicate_items: false },
  });
  pgm.addIndex('t100', 'tags', {
    method: 'gin',
    storageParameters: { fastupdate: false, gin_pending_list_limit: 64 },
  });
  pgm.createIndex('t100', 'location', {
    method: 'gist',
    storageParameters: { buffering: 'off' },
  });
};
