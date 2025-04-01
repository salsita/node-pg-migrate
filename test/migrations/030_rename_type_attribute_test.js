export const up = (pgm) => {
  pgm.sql("SELECT (ROW(1, 'x')::obj).str;");
};

export const down = () => null;
