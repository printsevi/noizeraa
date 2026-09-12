/**
 * Architectural boundaries, enforced (root CLAUDE.md "Architecture",
 * tech proposal §3). Run via `pnpm lint:deps`. Each rule names the
 * boundary it guards; a violation is a design error, not a lint nit.
 *
 * Backend modules: apps/api/src/<module>/ ↔ packages/infra/src/<module>/
 * share a name. A module may import its own infra subpath and
 * @noizera/infra/shared — never another module's.
 *
 * Patterns match both src/ and dist/ because pnpm symlinks resolve
 * @noizera/* imports to the built dist/ of the real package directory.
 */

const MODULES = [
  "identity",
  "catalog",
  "media",
  "sharing",
  "panels",
  "listeners",
  "responses",
  "results",
  "billing",
  "editorial",
  "admin",
];

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-is-pure",
      comment:
        "packages/domain has no framework, no Drizzle, no workspace deps — entities and events only.",
      severity: "error",
      from: { path: "^packages/domain/src" },
      to: {
        dependencyTypes: ["npm", "npm-dev", "npm-peer"],
      },
    },
    {
      name: "domain-never-imports-infra-or-apps",
      severity: "error",
      from: { path: "^packages/domain/src" },
      to: { path: "^(?:packages/(?:infra|contracts)|apps)/" },
    },
    {
      name: "contracts-only-zod",
      comment:
        "Schemas and derived types only; no business logic, no framework.",
      severity: "error",
      from: { path: "^packages/contracts/src" },
      to: {
        dependencyTypes: ["npm", "npm-dev", "npm-peer"],
        pathNot: "^node_modules/(zod|@asteasolutions/zod-to-openapi)/",
      },
    },
    {
      name: "contracts-never-imports-workspace",
      severity: "error",
      from: { path: "^packages/contracts/src" },
      to: { path: "^(?:packages/(?:domain|infra)|apps)/" },
    },
    {
      name: "infra-never-imports-apps-or-contracts",
      severity: "error",
      from: { path: "^packages/infra/src" },
      to: { path: "^(?:apps|packages/contracts)/" },
    },
    {
      name: "infra-module-isolation",
      comment:
        "A module's repositories may use shared/ but not another module's directory.",
      severity: "error",
      from: {
        path: `^packages/infra/(?:src|dist)/(${MODULES.join("|")})/`,
        pathNot: "^packages/infra/(?:src|dist)/shared/",
      },
      to: {
        path: `^packages/infra/(?:src|dist)/(${MODULES.join("|")})/`,
        pathNot: "^packages/infra/(?:src|dist)/$1/",
      },
    },
    {
      name: "web-only-imports-contracts",
      comment:
        "apps/web is a BFF: it talks to the API over HTTP, never to domain/infra directly.",
      severity: "error",
      from: { path: "^apps/web/" },
      to: { path: "^packages/(?:domain|infra)/(?:src|dist)/" },
    },
    {
      name: "api-module-owns-its-infra",
      comment:
        "apps/api/src/<m> may import @noizera/infra/<m> and @noizera/infra/shared only.",
      severity: "error",
      from: { path: `^apps/api/src/(${MODULES.join("|")})/` },
      to: {
        path: `^packages/infra/(?:src|dist)/(${MODULES.join("|")})/`,
        pathNot: "^packages/infra/(?:src|dist)/$1/",
      },
    },
    {
      name: "api-modules-do-not-cross-import",
      comment:
        "Modules talk via application services/domain events exposed from their index, never via deep imports.",
      severity: "error",
      from: { path: `^apps/api/src/(${MODULES.join("|")})/` },
      to: {
        path: `^apps/api/src/(${MODULES.join("|")})/.+`,
        pathNot: [
          "^apps/api/src/$1/",
          `^apps/api/src/(${MODULES.join("|")})/index\\.ts$`,
        ],
      },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    // packages/*/dist is deliberately NOT excluded: workspace imports
    // resolve there, and excluding it would silently drop every
    // cross-package edge the rules above exist to check.
    exclude: {
      path: "(^apps/[^/]+/(dist|\\.next)/|(^|/)(\\.turbo|node_modules|e2e)/)",
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["main", "types"],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
