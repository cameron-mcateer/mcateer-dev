# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Astro dev server at `localhost:4321` (Node/Vite, not the Workers runtime).
- `npm run build` — production build into `./dist/`.
- `npm run preview` — build, then run the worker locally via `wrangler dev` (use this to exercise Cloudflare-specific behavior: workerd runtime, bindings, asset serving, the `global_fetch_strictly_public` compat flag).
- `npm run deploy` — build and deploy to Cloudflare Workers.
- `npm run generate-types` — regenerate `worker-configuration.d.ts` from `wrangler.jsonc` (run after editing bindings).
- `npm run astro check` — type-check `.astro` files (extends `astro/tsconfigs/strict`).

Node `>=22.12.0` is required.

## Architecture

Astro site rendered through the `@astrojs/cloudflare` adapter and served as a Cloudflare Worker. Build output is fully static — every route is prerendered at build time and served from `./dist/` via the `ASSETS` binding. There is no SSR or DB at runtime.

### Site shape

- `/` — landing page: static bio + nav.
- `/log` — chronological mixed feed of projects and notes.
- `/now` — current-focus page.
- `/projects/<slug>` — individual project entry.
- `/notes/<slug>` — individual note entry.
- `/rss.xml` — combined RSS feed.

There are intentionally no `/projects` or `/notes` index pages — `/log` is the only listing. Add filtered indexes only when entry volume justifies them.

### Content management

All content lives as Markdown files in `src/content/` with no DB or CMS. To publish: create a `.md` file with frontmatter, commit, push, deploy. Astro Content Collections (`src/content.config.ts`) defines two collections via the `glob` loader:

- `projects` — requires `title`, `summary`, `date`; optional `links.{github,demo}`, `draft`.
- `notes` — requires `title`, `date`; optional `summary`, `draft`.

Drafts (`draft: true`) are visible in dev and excluded from listings, individual pages, and RSS in production (gated on `import.meta.env.PROD` in `src/pages/log.astro`, the `[...slug].astro` routes, and `src/pages/rss.xml.ts`). Changing the draft filtering rule means updating all four places.

Entry `id` (used as the URL slug) is the filename without extension, relative to the collection's base directory.

### Styling

Hand-rolled CSS in `src/styles/global.css`, imported once via `src/layouts/Base.astro`. No framework. Dark mode is automatic via `@media (prefers-color-scheme: dark)` swapping CSS custom properties — there is no toggle. Typography: system serif for body, system sans for UI/headings, system mono for code (zero font requests).

### Release model

Two-branch + tag-driven deploys: develop on `main` (no deploy), cut a `release-*` tag at a commit you want to ship, dispatch the `release` GitHub Actions workflow against that tag, the workflow force-pushes the `release` branch to that commit, and Cloudflare Workers Builds deploys the push. Rollback is a new `release-*` tag at an older commit, dispatched the same way.

For the design rationale behind this shape — why tags + a pointer branch, why force-push, why the workflow exists rather than deploying tags directly, the rollback model, draft-flag orthogonality, and failure modes — see [`.claude/release.md`](.claude/release.md). The mechanics live in `.github/workflows/release.yml`.

### Cloudflare specifics

- `wrangler.jsonc` declares `main: "@astrojs/cloudflare/entrypoints/server"` and an `ASSETS` binding pointing at `./dist`. Adding bindings here must be followed by `npm run generate-types` so `worker-configuration.d.ts` stays in sync with `tsconfig.json`.
- `compatibility_flags: ["global_fetch_strictly_public"]` — outbound `fetch` from the worker cannot reach private/internal addresses; relevant if any integration is ever added.
- `public/.assetsignore` controls what Wrangler excludes from the asset upload.
- `astro.config.mjs` sets `site:` — RSS and any canonical-URL generation depend on it. Update before first real deploy.
