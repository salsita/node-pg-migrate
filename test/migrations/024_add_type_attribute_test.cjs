exports.up = (pgm) => {
  pgm.sql("SELECT (ROW(1, 'x')::obj).string;");
};

exports.down = () => null;
