exports.up = async (pgm) => {
  const [{ id }] = await pgm.db.select('INSERT INTO ts DEFAULT VALUES RETURNING id;')
  if (id !== 10) {
    throw new Error('Bad sequence value')
  }
}

exports.down = () => null
