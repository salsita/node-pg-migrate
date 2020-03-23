exports.up = (pgm) => pgm.db.query('INSERT INTO t1(nmbr) VALUES (30);')

exports.down = () => null
