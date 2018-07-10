exports.up = pgm => {
  pgm.renameTypeValue("list", "a", "e");
};
