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

