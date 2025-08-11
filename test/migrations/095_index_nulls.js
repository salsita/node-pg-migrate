const getMajorVersion = async (pgm) => {
  const [{ server_version: version }] = await pgm.db.select(
    'SHOW "server_version"'
  );
  const [major] = version.split('.');
  return Number(major);
};

const isSupportedVersion = (major) => major >= 15;

export const up = async (pgm) => {
  const major = await getMajorVersion(pgm);
  if (isSupportedVersion(major)) {
    pgm.createTable('t095', { id: { type: 'integer' } });
    pgm.createIndex('t095', 'id', { unique: true, nulls: 'not distinct' });
  }
};

export const down = async (pgm) => {
  const major = await getMajorVersion(pgm);
  if (isSupportedVersion(major)) {
    pgm.dropTable('t095');
  }
};
