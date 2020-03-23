const getMajorVersion = async (pgm) => {
  const [{ server_version: version }] = await pgm.db.select(`SHOW "server_version"`)
  const [major] = version.split('.')
  return Number(major)
}

const isSupportedSequenceGeneratedVersion = (major) => major >= 10
const isSupportedExpressionGeneratedVersion = (major) => major >= 12

exports.up = async (pgm) => {
  const major = await getMajorVersion(pgm)
  if (isSupportedSequenceGeneratedVersion(major)) {
    pgm.createTable('t_sequenceGenerated', {
      id: 'id',
      gen: {
        type: 'integer',
        notNull: true,
        sequenceGenerated: {
          precedence: 'BY DEFAULT',
          increment: 2,
        },
      },
    })
    pgm.sql('INSERT INTO "t_sequenceGenerated" DEFAULT VALUES')
  }
  if (isSupportedExpressionGeneratedVersion(major)) {
    pgm.createTable('t_expressionGenerated', {
      id: 'id',
      gen: {
        type: 'integer',
        notNull: true,
        expressionGenerated: 'id + 1',
      },
    })
    pgm.sql('INSERT INTO "t_expressionGenerated" DEFAULT VALUES')
  }
}

exports.down = async (pgm) => {
  const major = await getMajorVersion(pgm)
  if (isSupportedSequenceGeneratedVersion(major)) {
    pgm.dropTable('t_sequenceGenerated')
  }
  if (isSupportedExpressionGeneratedVersion(major)) {
    pgm.dropTable('t_expressionGenerated')
  }
}
