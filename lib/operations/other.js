import { t } from '../utils';

// eslint-disable-next-line import/prefer-default-export
export const sql = (...args) => {
  // applies some very basic templating using the utils.p
  let s = t(...args);
  // add trailing ; if not present
  if (s.lastIndexOf(';') !== (s.length - 1)) {
    s += ';';
  }
  return s;
};
