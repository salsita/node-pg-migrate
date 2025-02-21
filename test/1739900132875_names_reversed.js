import { up as originalUp } from './1414549381268_names_promise.js';

export const up = (pgm) => {
  pgm.enableReverseMode();
  return originalUp(pgm);
};
