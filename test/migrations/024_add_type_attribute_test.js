export const up = (pgm) => {
  pgm.sql("SELECT (ROW(1, 'x')::obj).string;");
};

export const down = () => null;
