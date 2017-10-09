import { expect } from 'chai';
import { escapeValue, PgLiteral } from '../lib/utils';

describe('lib/utils', () => {
  describe('.escapeValue', () => {
    it('parse null to \'NULL\'', () => {
      const value = null;

      expect(escapeValue(value)).to.equal('NULL');
    });

    it('parse boolean to string', () => {
      const value = true;

      expect(escapeValue(value)).to.equal('true');
    });

    it('escape string', () => {
      const value = '#escape_me';

      expect(escapeValue(value)).to.equal('$pg1$#escape_me$pg1$');
    });

    it('keep number as is', () => {
      const value = 77.7;

      expect(escapeValue(value)).to.equal(77.7);
    });

    it('parse array to ARRAY constructor syntax string', () => {
      const value = [[1], [2]];
      const value2 = [['a'], ['b']];

      expect(escapeValue(value)).to.equal('ARRAY[[1],[2]]');
      expect(escapeValue(value2)).to.equal('ARRAY[[$pg1$a$pg1$],[$pg1$b$pg1$]]');
    });

    it('parse PgLiteral to unescaped string', () => {
      const value = PgLiteral.create('@l|<e');

      expect(escapeValue(value)).to.equal('@l|<e');
    });

    it('parse unexpected type to empty string', () => {
      const value = undefined;

      expect(escapeValue(value)).to.equal('');
    });
  });
});
