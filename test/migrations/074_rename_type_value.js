exports.up = pgm => {
  pgm.createType("list", ["a", "d", "c"]);
  pgm.renameTypeValue("list", "d", "b");
};
