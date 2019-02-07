exports.up = pgm => {
  pgm.createTable(
    "t_like",
    {},
    {
      like: {
        table: "t1",
        options: {
          including: ["COMMENTS", "CONSTRAINTS"],
          excluding: ["STATISTICS", "STORAGE"]
        }
      }
    }
  );
};

exports.down = () => null;
