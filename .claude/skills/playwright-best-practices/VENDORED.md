# Vendored skill

Source: https://github.com/currents-dev/playwright-best-practices-skill (MIT), commit `283d5cbc5d11aac1abda058b16ad22c317d54dc0`, skill version 1.2, vendored 2026-09-12.

Committed rather than installed globally so every clone gets the same guidance. Update with `npx skills add currents-dev/playwright-best-practices-skill@playwright-best-practices` (or re-copy from the repo) and bump the commit here.

Project precedence: where this skill and `tdd` disagree, `tdd` wins — in particular Playwright is for the listener-flow golden path only (`/l/[token]`), not general component/E2E coverage.
