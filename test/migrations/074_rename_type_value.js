exports.up = pgm => {
  pgm.createType("list2", ["a", "d", "c"]);
  pgm.renameTypeValue("list2", "d", "b");
};
