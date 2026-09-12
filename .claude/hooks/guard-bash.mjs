#!/usr/bin/env node
// PreToolUse hook for Bash: refuse commands that are user-run-only in
// this repo. Exit 2 = block, with the reason on stderr (shown to Claude).
// Node rather than shell so it behaves identically on Windows and Linux.
//
// Blocked (see CLAUDE.md "Claude Code hooks"):
//   tofu/terraform apply|destroy      — provisions/destroys billed infra (§11.3: gated workflow only)
//   drizzle-kit push                  — diffs against a live DB and can drop columns (§3.2)
//   git push --force / -f             — rewrites shared history
//   docker compose down -v / --volumes— deletes data volumes
//   rm -rf outside the scratchpad     — recursive deletes in the project tree

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let command = "";
  try {
    command = JSON.parse(input)?.tool_input?.command ?? "";
  } catch {
    process.exit(0);
  }

  // CMD = the token is in command position (start of input/line, or
  // after ; && || | ( or a `pnpm exec`/`npx`/`sudo` prefix) — so prose
  // inside a commit message or an echo doesn't trip the guard.
  const CMD = String.raw`(?:^|[\n;|&(]\s*|\b(?:exec|npx|sudo)\s+)`;
  const rules = [
    {
      re: new RegExp(
        CMD + String.raw`(?:tofu|terraform)\s+(?:apply|destroy)\b`,
        "m",
      ),
      why: "tofu apply/destroy provisions or destroys billed infrastructure — only .github/workflows/infra-apply.yml may run it, and only a human triggers that.",
    },
    {
      re: new RegExp(CMD + String.raw`drizzle-kit\s+push\b`, "m"),
      why: "drizzle-kit push diffs against the live database and can drop columns; use `drizzle-kit generate` and commit the SQL (tech proposal §3.2).",
    },
    {
      re: new RegExp(
        CMD +
          String.raw`git\s+push\b[^\n]*\s(?:--force|-f|--force-with-lease)\b`,
        "m",
      ),
      why: "force-pushing rewrites shared history; ask the user to run it.",
    },
    {
      re: new RegExp(
        CMD +
          String.raw`docker\s+compose\b[^\n]*\bdown\b[^\n]*\s(?:-v|--volumes)\b`,
        "m",
      ),
      why: "docker compose down -v deletes data volumes; ask the user to run it.",
    },
    {
      re: new RegExp(
        CMD +
          String.raw`rm\s+(?:-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\b(?![^\n]*(?:scratchpad|\/tmp\/|\$TMPDIR|\$HOME\/\.corepack))`,
        "m",
      ),
      why: "recursive force delete outside the scratchpad; delete specific files instead, or ask the user.",
    },
  ];

  for (const { re, why } of rules) {
    if (re.test(command)) {
      process.stderr.write(`Blocked by .claude/hooks/guard-bash.mjs: ${why}\n`);
      process.exit(2);
    }
  }
  process.exit(0);
});
