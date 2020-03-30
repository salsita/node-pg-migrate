exports.up = async (pgm) => {
  const [{ sum }] = await pgm.db.select('SELECT ROW(1,2)::complex + ROW(3,4)::complex as sum;')
  if (sum !== '(4,6)') {
    throw new Error('Bad sequence value')
  }
}

exports.down = () => null
