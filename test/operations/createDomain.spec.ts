import { describe, expect, it } from 'vitest';
import { createDomain } from '../../src/operations/domains';
import { options1 } from '../utils';

describe('operations', () => {
  describe('createDomain', () => {
    it('should return a function', () => {
      const actual = createDomain(options1);

      expect(actual).toBeTypeOf('function');
    });

    it('should return a function', () => {
      const createDomainFn = createDomain(options1);

      const actual = createDomainFn('domainName', 'type');

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('CREATE DOMAIN "domainName" AS type;');
    });
  });
});
