/**
 * Captures real `pg_dump` output of every schema fixture on every supported
 * PostgreSQL major version, so that unit tests can use real dumps without
 * starting databases.
 *
 * For each version it starts a `postgres:<major>-alpine` container, loads each
 * fixture into a fresh database with `loadFixture()` (which skips files that
 * need a newer server) and writes what the `pg_dump` inside the container
 * prints for `--schema-only --no-owner --no-privileges` to
 * `test/baseline/fixtures/dumps/pg<major>/<fixture>.sql`, unchanged: the random
 * `\restrict` keys and the version comments are part of real dumps.
 *
 * Run it after changing a fixture, with Docker available, and commit the
 * output: `CI=true pnpm run fixtures:capture`. `PGM_VERSIONS=17,18` limits it
 * to some versions.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import {
  createDatabase,
  loadFixture,
  SCHEMA_FIXTURES,
  setupPostgresDatabase,
} from '../integration/utils';

const DEFAULT_VERSIONS = ['14', '15', '16', '17', '18'];

const DUMPS_DIR = resolve(import.meta.dirname, '../baseline/fixtures/dumps');

/**
 * Captures the dumps of every fixture for one PostgreSQL major version.
 *
 * @param version The major version, e.g. `'18'`.
 *
 * @returns A promise that resolves once the dumps are written and the
 * container is gone.
 */
async function captureVersion(version: string): Promise<void> {
  const container = await setupPostgresDatabase(`postgres:${version}-alpine`);
  try {
    const dir = join(DUMPS_DIR, `pg${version}`);
    await mkdir(dir, { recursive: true });

    for (const fixture of SCHEMA_FIXTURES) {
      const database = `capture_${fixture.replaceAll('-', '_')}`;
      await createDatabase(container, database);
      await loadFixture(container, database, fixture);

      const res = await container.exec([
        'pg_dump',
        '-U',
        container.getUsername(),
        '-d',
        database,
        '--schema-only',
        '--no-owner',
        '--no-privileges',
      ]);
      if (res.exitCode !== 0) {
        throw new Error(
          `pg_dump failed for ${fixture} on PostgreSQL ${version}: ${res.stderr}`
        );
      }

      const file = join(dir, `${fixture}.sql`);
      await writeFile(file, res.stdout);
      console.log(
        `${relative(process.cwd(), file)}: ${res.stdout.length} characters`
      );
    }
  } finally {
    await container.stop();
  }
}

const versions = (process.env.PGM_VERSIONS ?? DEFAULT_VERSIONS.join(','))
  .split(',')
  .map((version) => version.trim())
  .filter(Boolean);

for (const version of versions) {
  await captureVersion(version);
}
