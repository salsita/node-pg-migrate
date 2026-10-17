import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  BaselineError,
  generateBaselineFromCatalogs,
} from 'node-pg-migrate/baseline/catalogs';
import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import pg from 'pg';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
} from 'vitest';
import { browserBundleImports } from '../baseline/browserBundle';
import {
  createDatabase,
  databaseUrl,
  loadFixture,
  PG_VERSIONS,
  runCli,
  setupPostgresDatabase,
} from './utils';

// The published entry `node-pg-migrate/baseline/catalogs`, as `pnpm run build`
// makes it: packages resolve it through the `exports` of package.json, with
// its types; it runs in browsers; and it generates exactly the migration that
// the built CLI writes with `baseline --format ts|js`.

// `execFile` returns a `ChildProcess` instead of `void`, which is the
// documented Node.js signature `promisify` is designed to consume.
// oxlint-disable-next-line typescript/strict-void-return
const execFileAsync = promisify(execFile);

const REPO_ROOT = resolve(import.meta.dirname, '../..');

/**
 * The entry, as packages import it.
 */
const SPECIFIER = 'node-pg-migrate/baseline/catalogs';

/**
 * The `exports` of package.json.
 */
type PackageExports = Readonly<
  Record<string, string | Readonly<Record<string, string>>>
>;

/**
 * Resolves and imports the entry the way Node.js does in a package that
 * depends on node-pg-migrate: in a child process, from the repository, which
 * links node-pg-migrate to itself in its node_modules.
 *
 * @returns The file it resolves to, and the names the entry exports.
 */
async function importWithNode(): Promise<{
  readonly file: string;
  readonly exports: ReadonlyArray<string>;
}> {
  const script = [
    `const url = import.meta.resolve(${JSON.stringify(SPECIFIER)});`,
    'const entry = await import(url);',
    'process.stdout.write(JSON.stringify({ url, exports: Object.keys(entry) }));',
  ].join('\n');
  const { stdout } = await execFileAsync(
    process.execPath,
    ['--input-type=module', '--eval', script],
    { cwd: REPO_ROOT }
  );
  const { url, exports } = JSON.parse(stdout) as {
    readonly url: string;
    readonly exports: ReadonlyArray<string>;
  };

  return { file: realpathSync(fileURLToPath(url)), exports };
}

/**
 * The modules a declaration file imports or re-exports from, without its
 * comments.
 *
 * @param declarations The content of the file.
 *
 * @returns The module specifiers, in order.
 */
function importedModules(declarations: string): string[] {
  const code = declarations
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/^\s*\/\/.*$/gm, '');
  const specifiers = code.matchAll(
    /\bfrom\s*["']([^"']+)["']|\bimport\s*\(?\s*["']([^"']+)["']/g
  );

  return [...specifiers].map((match) => match[1] ?? match[2]);
}

/**
 * Creates a temporary directory that is removed when the current test
 * finishes.
 *
 * @returns The path of the directory.
 */
async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pgm-e2e-catalogs-'));
  onTestFinished(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  return dir;
}

/**
 * Connects a `pg` client that is closed when the current test finishes.
 *
 * @param url The database.
 *
 * @returns The connected client.
 */
async function connect(url: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  onTestFinished(async () => {
    await client.end();
  });

  return client;
}

describe('node-pg-migrate/baseline/catalogs, built', () => {
  it('resolves for Node.js to the built entry, which exports generateBaselineFromCatalogs and BaselineError', async () => {
    const { file, exports } = await importWithNode();

    expect(file).toBe(
      realpathSync(resolve(REPO_ROOT, 'dist/baseline/catalogs.js'))
    );
    expect(exports).toEqual(
      expect.arrayContaining(['BaselineError', 'generateBaselineFromCatalogs'])
    );
  });

  it('declares its types first, in a file that imports no module', async () => {
    const { exports } = JSON.parse(
      await readFile(resolve(REPO_ROOT, 'package.json'), 'utf8')
    ) as { readonly exports: PackageExports };
    const conditions = exports['./baseline/catalogs'];
    // TypeScript takes the first condition it knows, so `types` must come
    // before `default`.
    expect(conditions).toBeTypeOf('object');
    const [first, types] = Object.entries(conditions)[0];
    expect(first).toBe('types');

    const declarations = await readFile(resolve(REPO_ROOT, types), 'utf8');

    expect(declarations).toContain('generateBaselineFromCatalogs');
    expect(importedModules(declarations)).toEqual([]);
  });

  it('bundles for the browser with nothing left to import', async () => {
    const { file } = await importWithNode();

    expect(await browserBundleImports(file)).toEqual([]);
  });
});

describe.each(PG_VERSIONS)(
  'node-pg-migrate/baseline/catalogs, built (PG %s)',
  (postgresVersion) => {
    let container: StartedPostgreSqlContainer;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${postgresVersion}-alpine`
      );
      await createDatabase(container, 'chinook');
      await loadFixture(container, 'chinook', 'chinook');
    });

    afterAll(async () => {
      await container?.stop();
    });

    it.each(['ts', 'js'] as const)(
      'generates the migration that `baseline --format %s` writes',
      async (format) => {
        const url = databaseUrl(container, 'chinook');
        const cwd = await tempDir();
        const result = await runCli(['baseline', '--format', format], {
          cwd,
          env: { DATABASE_URL: url },
        });
        expect(result.code, result.stderr).toBe(0);
        const [file] = await readdir(join(cwd, 'migrations'));
        const content = await readFile(join(cwd, 'migrations', file), 'utf8');
        const migrationName = file.slice(0, -`.${format}`.length);

        const generated = await generateBaselineFromCatalogs(
          await connect(url),
          { format, migrationName }
        );

        expect(generated.content).toBe(content);
      }
    );

    it('refuses a database with migration history with the BaselineError it exports (HISTORY_EXISTS)', async () => {
      await createDatabase(container, 'history');
      const client = await connect(databaseUrl(container, 'history'));
      // What the runner records after `node-pg-migrate up`.
      await client.query(
        'CREATE TABLE public.pgmigrations (id serial PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL)'
      );
      await client.query(
        "INSERT INTO public.pgmigrations (name, run_on) VALUES ('1_first', pg_catalog.now())"
      );

      const error = await generateBaselineFromCatalogs(client, {
        migrationName: '1700000000000_baseline',
      }).catch((error: unknown) => error);

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'HISTORY_EXISTS' });
    });
  }
);
