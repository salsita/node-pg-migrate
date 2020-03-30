exports.up = async (pgm) => {
  const [{ a }] = await pgm.db.select('INSERT INTO tt (a) VALUES (1) RETURNING a')
  if (a !== 2) {
    throw new Error('Trigger does not work')
  }
}

exports.down = () => null
