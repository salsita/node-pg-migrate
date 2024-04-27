exports.up = (pgm) => {
  pgm.sql("SELECT (ROW(1, 'x')::obj).str;");
};

exports.down = () => null;
