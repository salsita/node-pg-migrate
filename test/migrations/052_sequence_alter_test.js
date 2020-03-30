exports.up = async (pgm) => {
  const [{ id }] = await pgm.db.select('INSERT INTO ts DEFAULT VALUES RETURNING id;')
  if (id !== 20) {
    throw new Error('Bad sequence value')
  }
}

exports.down = () => null
