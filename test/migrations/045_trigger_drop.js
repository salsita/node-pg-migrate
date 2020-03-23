const trigger = require('./043_trigger_create_rename')

exports.up = (pgm) => {
  pgm.dropTrigger('tt', 'trig')
  pgm.dropFunction('trig', [])
  pgm.dropTable('tt')
}

exports.down = trigger.up
