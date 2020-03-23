const getMajorVersion = (pgm) =>
  pgm.db.select(`SHOW "server_version"`).then(([{ server_version: version }]) => {
    const [major] = version.split('.')
    return Number(major)
  })

const isSupportedVersion = (major) => major >= 10

exports.up = (pgm) =>
  getMajorVersion(pgm).then((major) => {
    if (isSupportedVersion(major)) {
      pgm.createType('list2', ['a', 'd', 'c'])
      pgm.renameTypeValue('list2', 'd', 'b')
    }
  })

exports.down = (pgm) =>
  getMajorVersion(pgm).then((major) => {
    if (isSupportedVersion(major)) {
      pgm.dropType('list2')
    }
  })
