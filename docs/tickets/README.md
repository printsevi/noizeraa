# Tickets

One markdown file per unit of planned work, named `NNN-short-slug.md` (zero-padded, incrementing — check the highest existing number before assigning the next one). A ticket is the thing [[grill-me]] should have already been run against before it's picked up for [[tdd]]-driven implementation.

Status lives in the file's frontmatter (`status: open | in-progress | blocked | done`), not in a separate tracker or in the filename — grep for `status: open` to find what's live.

See `TEMPLATE.md` for the expected shape.
