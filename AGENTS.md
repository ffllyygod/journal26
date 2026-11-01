## Start here

Any agent working in this repo: read `docs/PROJECT_STATUS.md` first and update it in the same commit as your work. It records what is done, what is left, decisions and known risks.

Before finishing a change, run `npm run check`, `npm run test:e2e` and `npm run test:cloud`. This repo is public: never commit real journal content, personal details or credentials.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
