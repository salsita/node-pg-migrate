exports.up = (pgm) => {
  pgm.sql('CREATE TEMPORARY TABLE t_list_1 (l list);')
  pgm.sql("INSERT INTO t_list_1 (l) VALUES ('a');")
  pgm.sql('select (ROW(1)::obj).id;')
}

exports.down = () => null
