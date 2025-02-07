export const up = (pgm) => {
  pgm.alterMaterializedView('mv', {
    storageParameters: {
      autovacuum_enabled: false,
      autovacuum_vacuum_threshold: 10,
    },
  });
};

export const down = () => null;
