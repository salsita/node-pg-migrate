import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { shouldGenerateTypescript } from "../../src/utils/shouldGenerateTs";

describe("utils", () => {
  describe("shouldGenerateTypescript", () => {
    let projectDir: string;
    let originalCwd: string;

    beforeEach(() => {
      originalCwd = process.cwd();

      projectDir = mkdtempSync(join(tmpdir(), "generator-test-"));

      process.chdir(projectDir);
    });

    afterEach(() => {
      process.chdir(originalCwd);

      rmSync(projectDir, {
        recursive: true,
        force: true,
      });
    });

    describe("when tsconfig.json does not exist", () => {
      it("should return false when there are no TypeScript files", () => {
        const result = shouldGenerateTypescript();

        expect(result).toBe(false);
      });

      it("should return true when TypeScript files exist", () => {
        mkdirSync("src", {
          recursive: true,
        });

        writeFileSync("src/index.ts", "export const value = true;");

        const result = shouldGenerateTypescript();

        expect(result).toBe(true);
      });

      it("should ignore TypeScript files inside node_modules", () => {
        mkdirSync("node_modules/package", {
          recursive: true,
        });

        writeFileSync("node_modules/package/index.ts", "export {};");

        const result = shouldGenerateTypescript();

        expect(result).toBe(false);
      });

      it("should ignore TypeScript files inside dist", () => {
        mkdirSync("dist", {
          recursive: true,
        });

        writeFileSync("dist/index.ts", "export {};");

        const result = shouldGenerateTypescript();

        expect(result).toBe(false);
      });
    });

    describe("when tsconfig.json exists", () => {
      it("should return true when allowJs is not defined", () => {
        writeFileSync(
          "tsconfig.json",
          JSON.stringify({
            compilerOptions: {
              strict: true,
            },
          }),
        );

        const result = shouldGenerateTypescript();

        expect(result).toBe(true);
      });

      it("should return true when allowJs is false", () => {
        writeFileSync(
          "tsconfig.json",
          JSON.stringify({
            compilerOptions: {
              allowJs: false,
            },
          }),
        );

        const result = shouldGenerateTypescript();

        expect(result).toBe(true);
      });

      it("should return false when allowJs is true", () => {
        writeFileSync(
          "tsconfig.json",
          JSON.stringify({
            compilerOptions: {
              allowJs: true,
            },
          }),
        );

        const result = shouldGenerateTypescript();

        expect(result).toBe(false);
      });

      it("should return false when allowJs is true even if .ts files exist", () => {
        writeFileSync(
          "tsconfig.json",
          JSON.stringify({
            compilerOptions: {
              allowJs: true,
            },
          }),
        );

        mkdirSync("src", {
          recursive: true,
        });

        writeFileSync("src/index.ts", "export const value = true;");

        const result = shouldGenerateTypescript();

        expect(result).toBe(false);
      });
    });

    describe("tsconfig with comments", () => {
      it("should parse tsconfig with line comments", () => {
        writeFileSync(
          "tsconfig.json",
          `
        {
          "compilerOptions": {
            // JavaScript is disabled
            "allowJs": false
          }
        }
        `,
        );

        expect(shouldGenerateTypescript()).toBe(true);
      });

      it("should parse tsconfig with block comments", () => {
        writeFileSync(
          "tsconfig.json",
          `
        {
          "compilerOptions": {
            /* allow JavaScript */
            "allowJs": true
          }
        }
        `,
        );

        expect(shouldGenerateTypescript()).toBe(false);
      });
    });
  });
});
