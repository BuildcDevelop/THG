# CODEX Operating Manual

## Project: The Last Dominion

### Purpose: Prevent Convex over-usage, bandwidth explosions, runaway ticks, and inefficient development patterns.

------------------------------------------------------------------------

# 0. NON-NEGOTIABLE RULES

1.  **Localhost ALWAYS runs locally on Patrick's PC (Disk D:)**
    -   All dev servers run locally.
    -   No accidental production calls from local environment.
    -   Project directory MUST live on `D:\`, never `C:\`.
2.  **Convex DEV deployment ONLY during development**
    -   Never use production Convex URL in development.
    -   Always verify `.env.local` before running dev server.
    -   If deployment is unclear → STOP and verify.
3.  **NO polling loops**
    -   No `setInterval(fetch, 1000)`
    -   No automatic periodic database refreshes.
4.  **Tick system must be event-driven**
    -   Never compute whole world on every tick.
    -   No full player scans.
    -   No full map scans.
5.  **Every commit must not increase bandwidth usage**
    -   If a change increases reads → justify it explicitly.
    -   Prefer reduction or neutral impact.

------------------------------------------------------------------------

# 1. CONVEX BANDWIDTH & READ OPTIMIZATION

## 1.1 Query Rules

-   Never return full documents if only partial data is needed.
-   Always use pagination and limits.
-   Never use `getAll()` without limit.
-   Never call snapshot/summary functions repeatedly.
-   No world-state queries.

------------------------------------------------------------------------

## 1.2 Subscription Rules

-   Subscriptions must return minimal payload.
-   Prefer diff/patch over full snapshot.
-   No subscription to entire world state.
-   Separate:
    -   list view (lightweight)
    -   detail view (on demand)

------------------------------------------------------------------------

## 1.3 Client Cache Rules

-   Use local state cache.
-   Avoid re-fetching on re-render.
-   Stable dependency arrays in React.
-   No automatic refresh unless user-triggered.

------------------------------------------------------------------------

## 1.4 Strictly Forbidden Patterns

-   Polling loops
-   Full world refresh
-   Snapshot sync calls in loops
-   N+1 queries
-   Fetch on every component mount without memoization

------------------------------------------------------------------------

# 2. TICK SYSTEM ARCHITECTURE

## 2.1 Event-Driven Tick

Ticks trigger only when: - Build starts - Unit training starts -
Movement starts - Combat resolves - Action deadline reached

Never tick entire player base.

------------------------------------------------------------------------

## 2.2 Pending Actions Model

Use collection: `pendingActions`

Fields: - actionId - type - ownerId - villageId - dueAt - payload

Processing: - Query only actions with `dueAt <= now` - Process in
batches - Remove or reschedule

Never scan all players.

------------------------------------------------------------------------

## 2.3 Resource Production (Delta-Based)

Store: - lastProducedAt - productionRate - storageCap

When user interacts: - delta = now - lastProducedAt - apply production
once - update lastProducedAt

Never increment per tick in database.

------------------------------------------------------------------------

## 2.4 Army & Movement

Store: - departAt - arriveAt - units - from - to

Compute only at arrival time. Never continuously simulate movement.

------------------------------------------------------------------------

## 2.5 Map Optimization

Default tile data: - tileType - owner - level - hasVillage

Detailed info only on interaction.

------------------------------------------------------------------------

# 3. DEVELOPMENT WORKFLOW RULES

## 3.1 Local Development

-   Project root MUST be on D: drive.
-   No heavy caches on C:.
-   Dev server never runs against production Convex.

------------------------------------------------------------------------

## 3.2 Environment Separation

.env.local → DEV\
.env.production → PROD

Never fallback to production URL if missing.

------------------------------------------------------------------------

## 3.3 Mock First Strategy

Before touching Convex: - Create local mock - Test tick logic offline

------------------------------------------------------------------------

## 3.4 Commit Rules

Each commit must answer:

-   [ ] No polling added
-   [ ] No full scans added
-   [ ] Queries are paginated
-   [ ] Payload minimized
-   [ ] Tick system event-driven
-   [ ] Local test passed

------------------------------------------------------------------------

# 4. SAFETY GUARDRAILS

## 4.1 Rate Limiting

-   Debounce client actions
-   Throttle repeated requests
-   Limit heavy endpoints

------------------------------------------------------------------------

## 4.2 Logging

-   Log errors only
-   Do not log full world state
-   Avoid console spam with large payloads

------------------------------------------------------------------------

## 4.3 Emergency Kill Switch

Environment flags: - DISABLE_REALTIME_HEAVY_QUERIES -
DISABLE_WORLD_SNAPSHOT

------------------------------------------------------------------------

# 5. MOST EXPENSIVE CONVEX OPERATIONS

High risk: - getSnapshot - getDatabaseSummary - Full import/export -
Unindexed queries - Full world subscriptions

Avoid at all costs.

------------------------------------------------------------------------

# 6. TARGET: 100 ACTIVE PLAYERS

Architecture must ensure:

-   No 1 tick = 100 reads
-   Only process active pending actions
-   Lazy resource updates
-   Detail views on demand
-   No global recalculations

------------------------------------------------------------------------

# 7. FINAL MANTRA

Localhost on D:\
Convex DEV only\
No polling\
No snapshots\
Event-driven jobs\
Delta calculations\
Lightweight map\
Commit must not increase bandwidth

------------------------------------------------------------------------

If unsure → STOP and analyze bandwidth impact before implementing.
