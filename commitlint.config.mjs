// Conventional commits (feat/fix/chore/docs/refactor/test/ci/build/infra).
// Scope is free-form; use the backend module name where one applies.
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "build",
        "chore",
        "ci",
        "docs",
        "feat",
        "fix",
        "infra",
        "perf",
        "refactor",
        "revert",
        "test",
      ],
    ],
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
  },
};
