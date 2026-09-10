export const up = (pgm) => {
  pgm.addColumns('users', { contract_id: { type: 'varchar(255)' } });
};
