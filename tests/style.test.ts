import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";

test("layout rules reject dense code, fix spacing, and retain explicit JSX conditions", () => {
  const directory = mkdtempSync(join(tmpdir(), "cofar-style-"));
  const file = join(directory, "fixture.tsx");
  const executable = resolve("node_modules/.bin/oxlint");
  const args = ["-c", resolve(".oxlintrc.json"), file];
  const options = { stdio: "pipe" as const };

  try {
    writeFileSync(
      file,
      "export const value = () => {\nconst x = 1;\nreturn x;\n};\n"
    );
    expect(() => {
      return execFileSync(executable, args, options);
    }).toThrow();
    execFileSync(executable, [...args, "--fix"], options);

    const fixed = readFileSync(file, "utf8");

    expect(fixed).toContain("const x = 1;\n\nreturn x;");
    execFileSync(executable, args, options);
    writeFileSync(
      file,
      "export const View = () => <div>{true && <span>Hi</span>}</div>;\n"
    );
    expect(() => {
      return execFileSync(executable, args, options);
    }).toThrow();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("layout rules reject function declarations", () => {
  const directory = mkdtempSync(join(tmpdir(), "cofar-style-"));
  const file = join(directory, "fixture.ts");
  const executable = resolve("node_modules/.bin/oxlint");
  const args = ["-c", resolve(".oxlintrc.json"), file];
  const options = { stdio: "pipe" as const };

  try {
    writeFileSync(file, "export function named() {\n  return 1;\n}\n");
    expect(() => {
      return execFileSync(executable, args, options);
    }).toThrow();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
