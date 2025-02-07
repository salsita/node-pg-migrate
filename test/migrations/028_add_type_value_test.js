export const up = (pgm) => {
  pgm.sql('CREATE TEMPORARY TABLE t_list_2 (l list);');
  pgm.sql("INSERT INTO t_list_2 (l) VALUES ('d');");
};

export const down = () => null;
