#!/usr/bin/env node
// PostToolUse hook for Edit/Write: prettier the file that was just
// touched, if prettier handles it and it's inside the repo. Silent on
// success; never fails the tool call (exit 0 always) — formatting is a
// convenience here, CI's `format:check` is the gate.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(
  new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  "..",
  "..",
);
const prettier = path.join(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prettier.cmd" : "prettier",
);

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let file = "";
  try {
    file = JSON.parse(input)?.tool_input?.file_path ?? "";
  } catch {
    process.exit(0);
  }
  if (!file || !existsSync(prettier)) process.exit(0);

  const abs = path.resolve(file);
  if (!abs.startsWith(root)) process.exit(0);
  if (!/\.(ts|tsx|js|mjs|cjs|json|md|yml|yaml|css)$/.test(abs)) process.exit(0);

  try {
    execFileSync(
      prettier,
      ["--write", "--log-level", "silent", "--ignore-unknown", abs],
      {
        cwd: root,
        stdio: "ignore",
        shell: process.platform === "win32",
      },
    );
  } catch {
    // ignore — a syntax error mid-edit shouldn't fail the edit
  }
  process.exit(0);
});
