const getMajorVersion = async (pgm) => {
  const [{ server_version: version }] = await pgm.db.select(
    'SHOW "server_version"'
  );
  const [major] = version.split('.');
  return Number(major);
};

const isSupportedVersion = (major) => major >= 17;

export const up = async (pgm) => {
  const major = await getMajorVersion(pgm);
  if (isSupportedVersion(major)) {
    pgm.createTable('t093', {
      id: { type: 'integer', notNull: true },
      other: { type: 'integer', notNull: true },
      col1: { type: 'integer', expressionGenerated: 'other + 1' },
      col2: { type: 'integer', expressionGenerated: 'other + 1' },
    });
    pgm.alterColumn('t093', 'col1', { expressionGenerated: 'other + 2' });
    pgm.alterColumn('t093', 'col2', { expressionGenerated: null });
  }
};

export const down = async (pgm) => {
  const major = await getMajorVersion(pgm);
  if (isSupportedVersion(major)) {
    pgm.dropTable('t093');
  }
};
