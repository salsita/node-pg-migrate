exports.up = (pgm) => {
  pgm.sql("select (ROW(1, 'x')::obj).str;")
}

exports.down = () => null
