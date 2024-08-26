exports.up = async (pgm) => {
  const [{ r }] = await pgm.db.select('SELECT add(1,2) AS r');
  if (r !== 3) {
    throw new Error('Function does not work');
  }
};

exports.down = () => null;
