# Repository Conventions

## Commits

- Use Conventional Commits: `type(scope): subject`
- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- Use `!` for breaking changes, e.g. `feat(api)!: remove legacy endpoint`
- Keep subject in imperative mood and under 72 chars when possible

## Branches

- Use Conventional Branches style: `type/short-kebab-description`
- Optional ticket prefix is allowed: `type/TICKET-short-kebab-description`
- Examples:
  - `feat/docker-api-migration`
  - `fix/cors-origin-handling`
  - `chore/update-docs`

## Review Feedback

- Write review feedback using Conventional Comments prefixes
- Preferred prefixes: `issue:`, `suggestion:`, `question:`, `nitpick:`, `praise:`
- Keep comments actionable and specific

## Chat Archive Rule

- After every chat in this repository, append a concise summary entry to `arch/chat-changelog.md`.
- Never overwrite previous chat entries. Always keep full history.
- Every entry must include: date, branch, user request, summary of work, touched files, and verification status.
- This rule applies even when the chat mostly changes documentation or project instructions.

## Last Dominion Guardrails

- For any new gameplay, UI, map, economy, polling, backend data-flow, or performance-sensitive change in this repository, use `last-dominion-feature-guardrails` first.
- Pair `last-dominion-feature-guardrails` with another skill only when that second skill adds domain-specific value beyond the guardrails.
