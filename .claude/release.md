# Release theory

This document captures the *why* behind how this site releases. For the *how* (commands, workflow YAML), see `.github/workflows/release.yml` and the commands section of `CLAUDE.md`.

## The shape

Three actors, one concept each:

- **Git tags** hold release *identity*. Each release is a permanent, named, immutable marker on a specific commit. The tag history is the deploy log.
- **The `release` branch** is the production *pointer* — a mutable reference to "what is live right now." It is never edited by humans; only the release workflow moves it.
- **Cloudflare Workers Builds** is the deploy *executor*. It watches `release` for pushes and rebuilds + redeploys. It has no concept of tags or release identity.

The GitHub Actions release workflow is the *bridge*. It accepts a tag (selected via the dispatch UI's tag picker) and force-pushes the `release` branch to that tag's commit. That push is what Cloudflare sees.

## Why this shape

The natural single-actor design — "Cloudflare auto-deploys on push to `main`" — collapses two concerns (landing changes and publishing them) into one event. That works until it doesn't: you want to land a half-finished post, queue several changes, or sit on something for a day. Splitting "land" from "publish" requires a gate. The shape of the gate is the design question.

**Tags as the gate.** Tags are human-meaningful (a tag list reads as a deploy log), append-only (history is never destroyed), and native to git (no separate system to learn). Cloudflare Workers Builds doesn't watch tags directly — it watches branches. That mismatch is what the workflow exists to bridge.

**Separate `release` branch vs. deploying tags directly via GitHub Actions.** Two reasons to keep the branch:

1. **Auth boundary.** Workers Builds keeps Cloudflare credentials inside Cloudflare's GitHub App. There is no long-lived Cloudflare API token sitting in a GitHub Actions secret. The workflow only needs permission to push within its own repo.
2. **Emergency escape hatch.** Pushing directly to `release` deploys, whether or not GitHub Actions is healthy. The branch is the durable, low-tech interface to deploys; the workflow is the convenient interface on top.

**Force-push, not merge.** The `release` branch is a pointer, not a history. Force-pushing it to a tag's commit expresses "this is live now," which is the only thing about the branch that matters. A merge history on `release` would invite reasoning about "what was the previous release" through the branch — but that answer lives in the tag list, where it belongs and stays correct. The branch is mechanical; the tags are the record.

**Constrain to `release-*` tags.** Two guards in the workflow refuse anything that isn't a tag, and anything that doesn't match `release-*`. The first prevents accidental promotion of a branch HEAD (e.g., dispatching against `main`). The second prevents accidental promotion of unrelated tags (`v1.0.0-rc1`, third-party tags). They are cheap to add and turn a class of accidents into loud workflow failures rather than surprise deploys.

## Rollback

Rollback is **a new release tag at the old commit**, not a force-push of the release branch backward via a different mechanism. The flow:

```
git tag release-2026-05-14-rollback <old-commit-sha>
git push origin release-2026-05-14-rollback
# dispatch the workflow against the new tag
```

This keeps the tag history append-only and makes the rollback itself a first-class, named event. The deploy log (the tag list) shows that a rollback happened, when, and to which commit. The alternative — quietly moving `release` backward — would deploy the right thing but leave no trace in the history of why or when.

## Drafts and the release model

The `draft: true` frontmatter flag is orthogonal to the branch/tag mechanics. It is filtered at build time on `import.meta.env.PROD`: visible in `npm run dev`, hidden in any production build. Workers Builds runs production builds, so anything promoted via the workflow will hide drafts regardless of what is on `release` otherwise.

This means drafts can sit on `main` (and ride along into `release` when promoted) without leaking — they are hidden by the build, not by the branch model. The release model deliberately does not police what is "shippable" at the branch level; the content polices itself at the post level. This keeps the branch model purely mechanical.

## Failure modes and invariants

- **Pushing to `main` does nothing externally.** No CI runs, no deploy fires. `main` is the working space.
- **Pushing directly to `release` deploys.** The branch is not protected, by design (see "emergency escape hatch" above). If protected later, the workflow would need a PAT or GitHub App token instead of `GITHUB_TOKEN`.
- **Pushing a tag does nothing automatically.** Only explicit workflow dispatch promotes a tag. Cutting a tag and deploying it are separate intents.
- **Dispatching against a branch or non-`release-*` tag fails loudly.** The workflow's guards refuse with `::error::` annotations, producing a red X in the run history rather than a silent skip.
- **`release` and the latest `release-*` tag should stay in sync.** Cloudflare deploys whatever is on `release`. If they drift (e.g., from a manual push to `release`), the tag list stops being a faithful deploy log. Avoid pushing to `release` directly except in genuine emergencies.

## Trust model

No long-lived deploy credentials live in this repository. The workflow uses the default `GITHUB_TOKEN` with `contents: write` scoped only to this repo. Cloudflare Workers Builds was authorized once via Cloudflare's GitHub App; that authorization lives in the Cloudflare account, not in any GitHub secret. Compromising the repo would let an attacker push to `release` and ship malicious site contents, but it would not give them Cloudflare API access.
