# Chat Changelog

Purpose: persistent archive of repository chats and outcomes.

Rule:

- After every chat, append a new entry.
- Do not delete or rewrite older entries unless the user explicitly asks for cleanup.
- Keep entries short, factual, and scoped to the actual work done in that chat.

Entry template:

## YYYY-MM-DD HH:MM | branch: <branch-name>

- Request: <what the user asked for>
- Summary: <what was explained, changed, or decided>
- Files: <comma-separated file list or "none">
- Verification: <tests/checks run, or "not run">
- Notes: <important follow-up, assumptions, or rule updates>

## 2026-03-10 11:05 | branch: feat/build-0.1.11

- Request: Explain what this project is about and set a permanent rule to keep a per-chat summary changelog in `arch`.
- Summary: Reviewed the repository purpose from `README.md`, confirmed the active branch, created this archive file, and added a permanent instruction in `AGENTS.md` so every future chat appends a history entry here.
- Files: AGENTS.md, arch/chat-changelog.md
- Verification: Confirmed current branch is `feat/build-0.1.11`; no tests were run because this change is documentation-only.
- Notes: Future chats should append new sections to this file instead of replacing existing content.

## 2026-03-10 23:17 | branch: feat/build-0.1.11

- Request: Implement the previously proposed CPU/RAM optimization changes on branch `feat/build-0.1.11`.
- Summary: Reduced frontend background work by removing the root one-second `GamePage` timer, stopping hidden panel polling, memoizing heavy city/army panels, and narrowing communication polling to active contexts. Preserved read-only behavior for `/api/v1/state` and `/api/v1/world-map` while keeping world-map versioned snapshots on the client, then updated the mint regression to match the new no-write-on-read contract.
- Files: server/gameService.js, src/api/gameApi.ts, src/components/CommunicationHub.tsx, src/pages/GamePage.tsx, tests/regression/game-rules.regression.test.mjs, tests/regression/game-rules.scenario.mjs, arch/chat-changelog.md
- Verification: `npm run build`; `npm run test:regression`
- Notes: World-map read models in this branch already use a cached versioned read model; the remaining long-term backend opportunity is to split shared world snapshot data from viewer-specific overlay invalidation.

## 2026-03-11 07:36 | branch: feat/build-0.1.11

- Request: Investigate the history of the map zoom math in `feat/build-0.1.11`, compare the first deployed version with later changes, and explain why the first smooth version felt less jerky.
- Summary: Traced `GamePage.tsx` history across `eb4c41b`, `3165701`, and `4ccabd8`. Confirmed the first fine-grained smooth zoom shipped in `eb4c41b` with RAF easing toward a target, later changed in `3165701` to UI-first batched wheel commits, and changed again in `4ccabd8` to target-based exponential interpolation now present in `feat/build-0.1.11`. Identified likely jerkiness cause as float zoom interpolation combined with integer-rounded map cell sizing.
- Files: arch/chat-changelog.md
- Verification: `git log --oneline --decorate --graph --all -- src/pages/GamePage.tsx`, `git diff eb4c41b 3165701 -- src/pages/GamePage.tsx`, `git diff 3165701 4ccabd8 -- src/pages/GamePage.tsx`, `git blame`, `git branch --contains`
- Notes: No gameplay or UI code was changed in this chat; findings were limited to repository history and current implementation analysis.

## 2026-03-11 07:42 | branch: feat/build-0.1.11

- Request: Prepare an implementation plan for a hybrid map zoom model, without making the code changes yet.
- Summary: Reviewed the Last Dominion feature guardrails and playbook, then defined a staged plan for a hybrid zoom model that keeps zoom local to the map panel, preserves the newer UI-first state ownership, and reintroduces the older smoother wheel feel without widening rerender or network scope.
- Files: arch/chat-changelog.md
- Verification: Reviewed `last-dominion-feature-guardrails` skill, `references/playbook.md`, and current zoom-related code locations in `src/pages/GamePage.tsx`.
- Notes: No gameplay, backend, or UI implementation changes were made in this chat.
