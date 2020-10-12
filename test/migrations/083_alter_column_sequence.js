const getMajorVersion = async (pgm) => {
  const [{ server_version: version }] = await pgm.db.select(`SHOW "server_version"`)
  const [major] = version.split('.')
  return Number(major)
}

const isSupportedVersion = (major) => major >= 10

exports.up = async (pgm) => {
  const major = await getMajorVersion(pgm)
  if (isSupportedVersion(major)) {
    pgm.createTable('t083', { id: { type: 'integer', notNull: true } })
    pgm.alterColumn('t083', 'id', { sequenceGenerated: { precedence: 'ALWAYS' } })
    pgm.alterColumn('t083', 'id', { sequenceGenerated: null })
  }
}

exports.down = async (pgm) => {
  const major = await getMajorVersion(pgm)
  if (isSupportedVersion(major)) {
    pgm.dropTable('t083')
  }
}
