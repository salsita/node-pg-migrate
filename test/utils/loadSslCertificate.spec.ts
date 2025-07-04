import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSslCaCertificate } from '../../src/utils';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

describe('utils', () => {
  describe('loadSslCaCertificate', () => {
    const mockReadFileSync = vi.mocked(readFileSync);

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should return empty object when no path provided', () => {
      const result = loadSslCaCertificate();

      expect(result).toEqual({});
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });

    it('should return ca certificate content when valid path provided', () => {
      const certPath = '/path/to/certificate.pem';
      const certContent =
        '-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END CERTIFICATE-----';

      mockReadFileSync.mockReturnValue(certContent);

      const result = loadSslCaCertificate(certPath);

      expect(result).toEqual({ ca: certContent });
      expect(mockReadFileSync).toHaveBeenCalledWith(certPath, 'utf8');
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });

    it('should throw error when file cannot be read', () => {
      const certPath = '/path/to/nonexistent.pem';
      const error = new Error('ENOENT: no such file or directory');

      mockReadFileSync.mockImplementation(() => {
        throw error;
      });

      expect(() => loadSslCaCertificate(certPath)).toThrow(
        `Error reading SSL CA certificate file: ${certPath} - ${error}`
      );
      expect(mockReadFileSync).toHaveBeenCalledWith(certPath, 'utf8');
    });
  });
});
