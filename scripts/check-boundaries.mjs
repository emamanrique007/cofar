import ts from "@typescript/typescript6";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";

const root = process.cwd();
const allowed = {
  types: [],
  utils: ["types"],
  builders: ["types", "utils"]
};
const errors = [];

const walk = dir => {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (
      ["node_modules", "dist", ".next", ".turbo", ".git"].includes(entry.name)
    ) {
      return [];
    }

    const path = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      return walk(path);
    }

    if (/\.[cm]?[jt]sx?$/.test(path)) {
      return [path];
    }

    return [];
  });
};

for (const path of [...walk("packages"), ...walk("apps")]) {
  const source = readFileSync(path, "utf8");
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const file = relative(root, path);
  const owner = file.match(/^packages\/([^/]+)/)?.[1];

  const visit = node => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const spec = node.moduleSpecifier.text;
      const target = spec.match(/^@cofar\/([^/]+)/)?.[1];

      if (owner && target && !allowed[owner]?.includes(target)) {
        errors.push(`${file}: forbidden dependency ${spec}`);
      }

      if (owner && (spec.startsWith("@/") || spec.includes("/apps/"))) {
        errors.push(`${file}: packages cannot import apps`);
      }

      if (spec.startsWith(".")) {
        const dest = relative(root, resolve(path, "..", spec));

        if (owner && !dest.startsWith(`packages/${owner}/`)) {
          errors.push(`${file}: cross-package relative import ${spec}`);
        }

        if (!owner && dest.startsWith("packages/")) {
          errors.push(`${file}: use package exports for ${spec}`);
        }
      }

      const client = /^\s*["']use client["']/.test(source);
      const typeOnly =
        ts.isImportDeclaration(node) && node.importClause?.isTypeOnly;

      if (
        client &&
        !typeOnly &&
        /server|supabase\.admin|^@\/trpc(?:\/|$)/.test(spec)
      ) {
        errors.push(`${file}: server import in client ${spec}`);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(ast);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  "Workspace boundaries OK (static imports); Next build checks transitive server-only imports."
);
