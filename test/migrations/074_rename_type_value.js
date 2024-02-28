const getMajorVersion = async (pgm) => {
  const [{ server_version: version }] = await pgm.db.select(
    `SHOW "server_version"`
  );
  const [major] = version.split('.');
  return Number(major);
};

const isSupportedVersion = (major) => major >= 10;

exports.up = async (pgm) => {
  const major = await getMajorVersion(pgm);
  if (isSupportedVersion(major)) {
    pgm.createType('list2', ['a', 'd', 'c']);
    pgm.renameTypeValue('list2', 'd', 'b');
  }
};

exports.down = async (pgm) => {
  const major = await getMajorVersion(pgm);
  if (isSupportedVersion(major)) {
    pgm.dropType('list2');
  }
};
