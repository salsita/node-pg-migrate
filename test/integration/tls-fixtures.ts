import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

// execFile returns a ChildProcess, matching Node's promisify convention.
// oxlint-disable-next-line typescript/strict-void-return
const execute = promisify(execFile);

export interface TlsCertificates {
  caFile: string;
  certFile: string;
  keyFile: string;
  wrongCaFile: string;
  mismatchedCertFile: string;
}

export async function createTlsCertificates(
  dir: string
): Promise<TlsCertificates> {
  // Requires an OpenSSL binary supporting req -addext on the host.
  const caFile = join(dir, 'root CA.crt');
  const caKey = join(dir, 'root-ca.key');
  const certFile = join(dir, 'server.crt');
  const keyFile = join(dir, 'server.key');
  const requestFile = join(dir, 'server.csr');
  const extensionsFile = join(dir, 'server.ext');
  const wrongCaFile = join(dir, 'wrong-ca.crt');
  const mismatchedCertFile = join(dir, 'mismatched-server.crt');

  for (const [certificate, key, name] of [
    [caFile, caKey, 'Migration Test Root CA'],
    [wrongCaFile, join(dir, 'wrong-ca.key'), 'Unrelated Test Root CA'],
  ]) {
    await execute('openssl', [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-sha256',
      '-days',
      '2',
      '-subj',
      `/CN=${name}`,
      '-addext',
      'basicConstraints=critical,CA:TRUE',
      '-addext',
      'keyUsage=critical,keyCertSign,cRLSign',
      '-keyout',
      key,
      '-out',
      certificate,
    ]);
  }
  await execute('openssl', [
    'req',
    '-new',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-subj',
    '/CN=localhost',
    '-keyout',
    keyFile,
    '-out',
    requestFile,
  ]);
  for (const [certificate, subjectAltName] of [
    [certFile, 'DNS:localhost,IP:127.0.0.1,IP:::1'],
    [mismatchedCertFile, 'DNS:db.invalid'],
  ]) {
    await writeFile(
      extensionsFile,
      [
        'basicConstraints=critical,CA:FALSE',
        'keyUsage=critical,digitalSignature,keyEncipherment',
        'extendedKeyUsage=serverAuth',
        `subjectAltName=${subjectAltName}`,
      ].join('\n')
    );
    await execute('openssl', [
      'x509',
      '-req',
      '-in',
      requestFile,
      '-CA',
      caFile,
      '-CAkey',
      caKey,
      '-CAcreateserial',
      '-days',
      '2',
      '-sha256',
      '-extfile',
      extensionsFile,
      '-out',
      certificate,
    ]);
  }
  return { caFile, certFile, keyFile, wrongCaFile, mismatchedCertFile };
}

export async function setupTlsPostgresDatabase(
  version: string,
  certificates: TlsCertificates,
  mismatched = false
): Promise<StartedPostgreSqlContainer> {
  const container = await new PostgreSqlContainer(`postgres:${version}-alpine`)
    .withUsername('ubuntu')
    .withPassword('ubuntu')
    .withDatabase('trusted_ca')
    .withSSL(
      mismatched ? certificates.mismatchedCertFile : certificates.certFile,
      certificates.keyFile,
      certificates.caFile
    )
    .withCopyContentToContainer([
      {
        target: '/docker-entrypoint-initdb.d/require-tls.sh',
        mode: 0o755,
        content: `#!/bin/sh
set -eu
cat > "$PGDATA/pg_hba.conf" <<'EOF'
local all all trust
hostssl all all all scram-sha-256
hostnossl all all all reject
EOF
`,
      },
    ])
    .start();
  if (!['localhost', '127.0.0.1', '::1'].includes(container.getHost())) {
    await container.stop();
    throw new Error(
      `TLS test certificate does not cover Docker host ${container.getHost()}`
    );
  }
  return container;
}
