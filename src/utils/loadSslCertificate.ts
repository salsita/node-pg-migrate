import { readFileSync } from 'node:fs';

/**
 * Load SSL CA certificate file from the file system.
 * 
 * @param caPath Optional path to the SSL CA certificate file
 * @returns Object containing the CA certificate content, or empty object if no path provided
 * @throws Error if the file cannot be read
 */
export function loadSslCaCertificate(caPath?: string): { ca?: string } {
  if (!caPath) {
    return {};
  }

  try {
    return { ca: readFileSync(caPath, 'utf8') };
  } catch (error) {
    throw new Error(
      `Error reading SSL CA certificate file: ${caPath} - ${error}`
    );
  }
} 