# Dark Medieval Typography Contract

## Canonical source of truth

1. Theme tokens in `body[data-ui-skin='dark-medieval']`
   - `--ui-type-h1`
   - `--ui-type-h2`
   - `--ui-type-h3`
   - `--ui-type-h4`
   - `--ui-type-body`
   - `--ui-type-note`
   - `--ui-type-meta`
   - `--ui-type-stat`

2. Explicit typography role utilities in `src/App.css`
   - `.tld-type-heading`
   - `.tld-type-body`
   - `.tld-type-note`
   - `.tld-type-meta`
   - `.tld-type-stat`
   - `.tld-type-value`
   - legacy-compatible `.ui-type-resource-value`

3. Runtime font scale in `src/pages/GamePage.tsx`
   - `document.documentElement.style.fontSize`
   - `data-game-font-scale`

## Minimum readability baseline (game UI)

- Regular body text minimum: `16px` (`--ui-type-body: 1rem`)
- Secondary/support text minimum: `15px` (`--ui-type-note: 0.9375rem`)
- Meta labels minimum: `14px` (`--ui-type-meta: 0.875rem`)
- Micro labels minimum: `13px` (`--ui-type-micro: 0.8125rem`) and only for dense UI chrome, not long prose
- Numeric compact values in village overlay are aligned to a shared readable baseline (`0.88rem`) for both resources and unit amounts

These minima are tuned for desktop strategy gameplay density while keeping the UI scalable via the existing font-scale mechanism.

## Role rules

- Heading: serif title treatment for named headings and title-like labels.
- Body: default readable UI text.
- Note: small helper or descriptive copy.
- Meta: smallest UI support copy.
- Stat: emphasized headline/stat text.
- Value: numeric or compact value role with tabular numerals.

## Phase 1 migration implemented

The following UI surfaces now use explicit role classes instead of relying only on `strong` or broad substring selectors:

- city overview stats
- city resource stock values
- multi-village unit pills
- military unit amount in army cards
- village panel inline resource amounts
- village panel unit values
- village resource card title
- research spotlight title

## Phase 2 migration implemented

The following broad typography rules were retired or narrowed to fallback behavior:

- removed blanket `resource/unit/army` font-size amplification
- removed broad `.panel-stack strong` stat sizing
- moved `.game-page .window-body` sizing to container inheritance
- kept form controls on explicit `font: inherit`

## Phase 3 migration implemented

The following stat/value surfaces now use explicit utility roles:

- multi-village overview fortification and gate pills
- all `commands-kpi-strip` value cells
- player profile stat cards
- battle power grids
- map settlement prestige totals and settlement prestige
- public order badge value

## Phase 4 migration implemented

The following remaining resource-strip strong selectors were retired:

- removed `.resource-strip strong`
- removed `.resource-card-right strong`
- removed font-scale variants for both selectors
- removed broad `.game-page .resource-card strong` fallback in favor of explicit card title classes

## Phase 5 migration implemented

The following additional strong-based presentation selectors were retired in favor of explicit role classes:

- removed `.game-page .game-footer-action strong`
- removed `.armada-unit-pill strong`
- removed `.battle-army-kpis strong`
- removed `.battle-loot-strip strong`
- removed `.commands-panel .army-order-preview-metrics strong`
- removed `.kingdom-audit-item strong`
- removed font-scale variant `:root[data-game-font-scale] .kingdom-audit-item strong`
- removed `.village-intel-tooltip li strong`
- removed `.village-fortification-card .village-fortification-levels strong`
- removed `.village-garrison-card strong`
- removed broad `.village-float-intel-card strong`

## Phase 6 migration implemented

The following messaging/report selectors were retired in favor of explicit role classes:

- removed `.messages-signal-chip strong`
- removed `.messages-report-item strong`
- removed `.battle-report-meta strong`
- removed `.battle-debug-list li strong`
- removed `.market-guild-audit-head strong`
- updated later warm-theme overrides from raw `strong` to `.messages-report-title` and `.battle-report-meta-value`

## Phase 7 migration implemented

The following inline prose/value surfaces were moved to explicit local typography roles:

- army command preview target, ETA, transfer total, and logistics total inline values
- battle return route, ETA, and duration inline values
- messages detail inline names in invite/report preview cards
- map settlement owner, kingdom, coordinates, and distance inline values
- building knight count inline value
- public-order tooltip inline values
- activity share dialog item title
- pin live feed activity badge value

## Phase 8 migration implemented

The following static copy emphasis surfaces were moved away from raw `strong` toward explicit local role classes:

- ranking placement highlighted label
- settings/help emphasis for Discord contact and keyboard hints
- map travel hint key label (`Ctrl`)
- world indicator current-world label
- world-switch option title
- village-menu option title
- dark-medieval world-switch overrides retargeted from raw `strong` to `.world-switch-option-title`

## Legacy selectors already reduced in phase 1

These selectors were narrowed or replaced by explicit classes in `src/App.css`:

- `body[data-ui-skin='dark-medieval'] .resource-strip strong`
- `body[data-ui-skin='dark-medieval'] .game-page .resource-card strong`
- `.city-stats-grid strong`
- `.multi-village-unit-pill strong`
- `.game-page .resource-strip.resource-strip-slim .public-order-badge strong`
- `.game-page .resource-strip.resource-strip-slim .village-resource-card-info strong`
- `.game-page :is(.resource-strip strong, .ui-type-resource-value, .city-stats-grid strong, .city-resource-stock-amount, .military-unit-amount, .multi-village-unit-pill strong, .multi-village-overview-level-pill strong, .commands-kpi-strip strong, .public-order-badge strong)`

## Legacy selectors pending later removal

There are no remaining pending legacy selectors in the resource-strip cleanup track. The next cleanup track should target unrelated legacy `strong` selectors outside the current game typography contract, such as communication, spawn/world setup, pin feed summaries, or other feature-specific panels that still use tag-based emphasis.

## Migration rule

New or touched game UI should prefer explicit role classes over styling raw `strong`, `span`, or tag selectors. Layout classes stay local to components. Typography role comes from the shared contract.
