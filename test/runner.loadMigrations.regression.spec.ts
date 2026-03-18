import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { RunnerOption } from "../src";
import type { DBConnection } from "../src/db";
import { loadMigrations } from "../src/runner";

async function withTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "npm-load-migrations-regression-"));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function writeMigrationFile(
  dir: string,
  fileName: string,
  content: string
): Promise<string> {
  const path = join(dir, fileName);
  await writeFile(path, content, "utf8");
  return path;
}

describe("loadMigrations regression behavior", () => {
  it("keeps legacy .sql handling and preserves migration paths by default", async () => {
    await withTempDir(async (dir) => {
      const singleSqlPath = await writeMigrationFile(
        dir,
        "001_single.sql",
        "-- up migration\nSELECT 1;\n-- down migration\nSELECT 0;\n"
      );
      const downSqlPath = await writeMigrationFile(
        dir,
        "002_pair.down.sql",
        "-- down migration\nDROP TABLE users;\n"
      );
      const upSqlPath = await writeMigrationFile(
        dir,
        "002_pair.up.sql",
        "-- up migration\nCREATE TABLE users(id serial primary key);\n"
      );
      const jsPath = await writeMigrationFile(
        dir,
        "003_script.js",
        "export const shorthands = {};\nexport const up = () => {};\nexport const down = () => {};\n"
      );

      const db: DBConnection = {} as never;
      const options: RunnerOption = {
        dir,
        ignorePattern: undefined,
        useGlob: false,
        migrationsTable: "migrations",
        direction: "up",
        databaseUrl: "postgres://user:pass@localhost/db",
      };

      const migrations = await loadMigrations(db, options, console);

      // Default behavior should keep .up/.down.sql as separate migrations.
      expect(migrations).toHaveLength(4);

      // Paths should remain concrete source paths (no id normalization by default).
      expect(migrations.map((migration) => migration.path)).toEqual([
        singleSqlPath,
        downSqlPath,
        upSqlPath,
        jsPath,
      ]);

      // Names are distinct for .up/.down pair under legacy default SQL handling.
      expect(migrations.map((migration) => migration.name)).toEqual([
        "001_single",
        "002_pair.down",
        "002_pair.up",
        "003_script",
      ]);
    });
  });

  it("keeps init before next when 001_init.sql is split into 001_init.up/down.sql", async () => {
    await withTempDir(async (dir) => {
      const initUpPath = await writeMigrationFile(
        dir,
        "001_init.up.sql",
        "CREATE TABLE init_table(id serial primary key);\n"
      );
      const initDownPath = await writeMigrationFile(
        dir,
        "001_init.down.sql",
        "DROP TABLE init_table;\n"
      );
      const nextPath = await writeMigrationFile(
        dir,
        "002_next.sql",
        "-- up migration\nSELECT 2;\n"
      );

      const db: DBConnection = {} as never;
      const options: RunnerOption = {
        dir,
        ignorePattern: undefined,
        useGlob: false,
        migrationsTable: "migrations",
        direction: "up",
        databaseUrl: "postgres://user:pass@localhost/db",
        migrationLoaderStrategies: [{ extensions: [".sql"], loader: "sql" }],
      };

      const migrations = await loadMigrations(db, options, console);

      expect(migrations).toHaveLength(2);
      expect(migrations.map((migration) => migration.path)).toEqual([
        join(dir, "001_init.sql"),
        nextPath,
      ]);
      expect(migrations.map((migration) => migration.name)).toEqual([
        "001_init",
        "002_next",
      ]);

      // Ensure files are truly split and still represented as one ordered migration.
      expect(initUpPath).toContain(".up.sql");
      expect(initDownPath).toContain(".down.sql");
    });
  });

  it("falls back to default loader for unmatched extensions when only .sql strategy is configured", async () => {
    await withTempDir(async (dir) => {
      const sqlPath = await writeMigrationFile(
        dir,
        "001_init.sql",
        "-- up migration\nSELECT 1;\n"
      );
      const jsPath = await writeMigrationFile(
        dir,
        "002_next.js",
        "export const shorthands = {};\nexport const up = () => {};\nexport const down = () => {};\n"
      );

      const db: DBConnection = {} as never;
      const options: RunnerOption = {
        dir,
        ignorePattern: undefined,
        useGlob: false,
        migrationsTable: "migrations",
        direction: "up",
        databaseUrl: "postgres://user:pass@localhost/db",
        migrationLoaderStrategies: [{ extensions: [".sql"], loader: "sql" }],
      };

      const migrations = await loadMigrations(db, options, console);
      expect(migrations.map((migration) => migration.path)).toEqual([
        sqlPath,
        jsPath,
      ]);
      expect(migrations.map((migration) => migration.name)).toEqual([
        "001_init",
        "002_next",
      ]);
    });
  });

  it("throws when .sql and .up/.down forms are mixed for the same migration id", async () => {
    await withTempDir(async (dir) => {
      await writeMigrationFile(
        dir,
        "001_init.sql",
        "-- up migration\nSELECT 1;\n"
      );
      await writeMigrationFile(
        dir,
        "001_init.up.sql",
        "CREATE TABLE t(id serial primary key);\n"
      );

      const db: DBConnection = {} as never;
      const options: RunnerOption = {
        dir,
        ignorePattern: undefined,
        useGlob: false,
        migrationsTable: "migrations",
        direction: "up",
        databaseUrl: "postgres://user:pass@localhost/db",
        migrationLoaderStrategies: [{ extensions: [".sql"], loader: "sql" }],
      };

      await expect(loadMigrations(db, options, console)).rejects.toThrow(
        "Conflicting SQL migration files for 001_init: cannot mix .sql with .up/.down"
      );
    });
  });

  it("matches strategy extensions case-insensitively", async () => {
    await withTempDir(async (dir) => {
      const jsPath = await writeMigrationFile(
        dir,
        "001_case.js",
        "export const shorthands = {};\nexport const up = () => {};\nexport const down = () => {};\n"
      );

      const db: DBConnection = {} as never;
      const options: RunnerOption = {
        dir,
        ignorePattern: undefined,
        useGlob: false,
        migrationsTable: "migrations",
        direction: "up",
        databaseUrl: "postgres://user:pass@localhost/db",
        migrationLoaderStrategies: [{ extensions: [".JS"], loader: "default" }],
      };

      const migrations = await loadMigrations(db, options, console);
      expect(migrations).toHaveLength(1);
      expect(migrations[0].path).toBe(jsPath);
      expect(migrations[0].name).toBe("001_case");
    });
  });
});
