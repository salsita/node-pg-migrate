import assert from 'assert';
import { escapeValue, PgLiteral } from '../lib/utils';

describe('lib/utils', () => {
  describe('.escapeValue', () => {
    it('parse null to \'NULL\'', () => {
      const value = null;

      assert.equal(escapeValue(value), 'NULL');
    });

    it('parse boolean to string', () => {
      const value = true;

      assert.equal(escapeValue(value), 'true');
    });

    it('escape string', () => {
      const value = '#escape_me';

      assert.equal(escapeValue(value), '\'%23escape_me\'');
    });

    it('keep number as is', () => {
      const value = 77.7;

      assert.equal(escapeValue(value), 77.7);
    });

    it('parse array to ARRAY constructor syntax string', () => {
      const value = [[1], [2]];
      const value2 = [['a'], ['b']];

      assert.equal(escapeValue(value), 'ARRAY[[1],[2]]');
      assert.equal(escapeValue(value2), 'ARRAY[[\'a\'],[\'b\']]');
    });

    it('parse PgLiteral to unescaped string', () => {
      const value = PgLiteral.create('@l|<e');

      assert.equal(escapeValue(value), '@l|<e');
    });

    it('parse unexpected type to empty string', () => {
      const value = undefined;

      assert.equal(escapeValue(value), '');
    });
  });
});
