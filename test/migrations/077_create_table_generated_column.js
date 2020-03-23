const getMajorVersion = (pgm) =>
  pgm.db.select(`SHOW "server_version"`).then(([{ server_version: version }]) => {
    const [major] = version.split('.')
    return Number(major)
  })

const isSupportedVersion = (major) => major >= 10

exports.up = (pgm) =>
  getMajorVersion(pgm).then((major) => {
    if (isSupportedVersion(major)) {
      pgm.createTable('t_generated', {
        id: 'id',
        gen: {
          type: 'integer',
          notNull: true,
          generated: {
            precedence: 'BY DEFAULT',
            increment: 2,
          },
        },
      })
      pgm.sql('INSERT INTO "t_generated" DEFAULT VALUES')
    }
  })

exports.down = (pgm) =>
  getMajorVersion(pgm).then((major) => {
    if (isSupportedVersion(major)) {
      pgm.dropTable('t_generated')
    }
  })
