import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  loadMigrationUnits,
  type MigrationLoader,
  type MigrationLoaderConfig,
  type MigrationUnit,
} from "../src/migrationLoader";

async function withTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "npm-migration-loader-test-"));
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

describe("loadMigrationUnits", () => {
  it("keeps legacy SQL behavior by default (.up/.down are separate migrations)", async () => {
    await withTempDir(async (dir) => {
      const upPath = await writeMigrationFile(
        dir,
        "001_create_users.up.sql",
        "-- up migration\nCREATE TABLE users(id serial primary key);\n"
      );
      const downPath = await writeMigrationFile(
        dir,
        "001_create_users.down.sql",
        "-- down migration\nDROP TABLE users;\n"
      );

      const units = await loadMigrationUnits({}, [upPath, downPath]);

      expect(units).toHaveLength(2);
      expect(units.map((u) => u.id)).toEqual([downPath, upPath].sort());
      expect(units.every((u) => u.filePaths.length === 1)).toBe(true);
    });
  });

  it("groups .up/.down SQL files when the new sql loader is configured", async () => {
    await withTempDir(async (dir) => {
      const upPath = await writeMigrationFile(
        dir,
        "001_create_users.up.sql",
        "CREATE TABLE users(id serial primary key);\n"
      );
      const downPath = await writeMigrationFile(
        dir,
        "001_create_users.down.sql",
        "DROP TABLE users;\n"
      );

      const config: MigrationLoaderConfig = {
        migrationLoaderStrategies: [{ extensions: [".sql"], loader: "sql" }],
      };

      const units = await loadMigrationUnits(config, [upPath, downPath]);

      expect(units).toHaveLength(1);
      expect(units[0].id).toBe(join(dir, "001_create_users.sql"));
      expect(units[0].filePaths).toEqual([upPath, downPath]);
      expect(units[0].actions.up).toBeTypeOf("function");
      expect(units[0].actions.down).toBeTypeOf("function");
    });
  });

  it("throws when sql loader sees .down.sql without matching .up.sql", async () => {
    await withTempDir(async (dir) => {
      const downPath = await writeMigrationFile(
        dir,
        "001_create_users.down.sql",
        "DROP TABLE users;\n"
      );

      const config: MigrationLoaderConfig = {
        migrationLoaderStrategies: [{ extensions: [".sql"], loader: "sql" }],
      };

      await expect(loadMigrationUnits(config, [downPath])).rejects.toThrow(
        "Found .down.sql without matching .up.sql for 001_create_users"
      );
    });
  });

  it("uses custom loader only for matched extension buckets", async () => {
    await withTempDir(async (dir) => {
      const jsPath = await writeMigrationFile(
        dir,
        "001_script.js",
        "export const shorthands = {};\nexport const up = () => {};\nexport const down = () => {};\n"
      );
      const mjsPath = await writeMigrationFile(
        dir,
        "002_script.mjs",
        "export const shorthands = {};\nexport const up = () => {};\nexport const down = () => {};\n"
      );

      const customUnits: MigrationUnit[] = [
        {
          id: "custom-js-id",
          filePaths: [jsPath],
          actions: { up: () => undefined, down: () => undefined, shorthands: {} },
        },
      ];
      const customLoader: MigrationLoader = async () => customUnits;

      const config: MigrationLoaderConfig = {
        migrationLoaderStrategies: [{ extensions: [".js"], loader: customLoader }],
      };

      const units = await loadMigrationUnits(config, [jsPath, mjsPath]);
      const ids = units.map((u) => u.id);

      expect(ids).toContain("custom-js-id");
      expect(ids).toContain(mjsPath);
      expect(units).toHaveLength(2);
    });
  });
});
