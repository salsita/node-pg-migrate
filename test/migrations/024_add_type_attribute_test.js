exports.up = (pgm) => {
  pgm.sql("select (ROW(1, 'x')::obj).string;")
}

exports.down = () => null
