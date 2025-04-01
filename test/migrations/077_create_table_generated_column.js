const getMajorVersion = async (pgm) => {
  const [{ server_version: version }] = await pgm.db.select(
    'SHOW "server_version"'
  );
  const [major] = version.split('.');
  return Number(major);
};

const isSupportedVersion = (major) => major >= 10;

export const up = async (pgm) => {
  const major = await getMajorVersion(pgm);
  if (isSupportedVersion(major)) {
    pgm.createTable('t_generated', {
      id: 'id',
      gen: {
        type: 'integer',
        notNull: true,
        sequenceGenerated: {
          precedence: 'BY DEFAULT',
          increment: 2,
        },
      },
    });
    pgm.sql('INSERT INTO "t_generated" DEFAULT VALUES');
  }
};

export const down = async (pgm) => {
  const major = await getMajorVersion(pgm);
  if (isSupportedVersion(major)) {
    pgm.dropTable('t_generated');
  }
};
