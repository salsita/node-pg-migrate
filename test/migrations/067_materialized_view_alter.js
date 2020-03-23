exports.up = (pgm) => {
  pgm.alterMaterializedView('mv', {
    storageParameters: {
      autovacuum_enabled: false,
      autovacuum_vacuum_threshold: 10,
    },
  })
}

exports.down = () => null
