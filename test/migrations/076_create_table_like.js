export const up = (pgm) => {
  pgm.createTable(
    't_like',
    {},
    {
      like: {
        table: 't1',
        options: {
          including: ['COMMENTS', 'CONSTRAINTS'],
          excluding: ['INDEXES', 'STORAGE'],
        },
      },
    }
  );
};

export const down = () => null;
