export const up = (pgm) => {
  pgm.createExtension('uuid-ossp', { ifNotExists: true });
  pgm.dropExtension('uuid-ossp');
  pgm.createExtension('uuid-ossp');
  pgm.dropExtension('uuid-ossp');
};

export const down = () => null;
