# Card System Unification v1

Status: draft only, not integrated into runtime
Branch: `feat/build-0.1.16`

## Goal

Sjednotit pozadí a vizuální hierarchii karet napříč hrou tak, aby:

- karty nepadaly do stejné tonality jako panel pod nimi,
- semanticita byla čitelná přes akcent a hustotu povrchu, ne přes úplně jiný gradient pro každou sekci,
- další redesign nevedl k dalším lokálním override v `src/App.css`,
- dark-medieval skin nepřepisoval card surface chaoticky přes globální `section/article/li` pravidla.

## Feature Contract

- Goal: zavést jednotný card design system pro HUD, city, military, commands, messages, battle a profile.
- Authoritative state: CSS tokens a card role selectors, žádná změna aplikačního state.
- Fetch model: beze změny.
- Affected panels: `resource-card`, `panel-stack section`, `commands-item`, `military-unit-card`, následně `battle-*`, `messages-*`, `player-profile-*`.
- Regression risk: selector conflicts, nekonzistentní hover/focus stavy, příliš plochý kontrast mezi panelem a kartou.
- Before metrics: dnes existuje více konkurenčních card povrchů a několik globálních override pro `dark-medieval`.
- Expected impact: menší vizuální chaos, jasnější hierarchie povrchů, rychlejší další UI iterace.

## Root Problem

Aktuálně je v projektu několik card rodin, které používají různé kombinace:

- gradientu pozadí,
- bordery,
- vnitřního highlightu,
- box-shadow,
- semantic barvy v celé ploše karty.

To vede k tomu, že:

- některé karty mizí ve stejném tónu jako rodič,
- jiné jsou příliš výrazné a lámou konzistenci,
- `dark-medieval` skin přidává další vrstvu override a zvyšuje specifitu,
- frameless sweep musí neustále hasit konkrétní panely.

## Design Direction

Jednotný card systém má stát na jednom tmavém neutrálním povrchu s malým počtem variant.

Klíčové principy:

- Background role first: karta se liší podle role, ne podle sekce aplikace.
- Semantic accent second: útok, obrana, prestiž a warning se řeší akcentem, ne úplně jiným backgroundem.
- Contrast by layer: panel je nejtmavší, base card je o krok světlejší, elevated card o další krok světlejší.
- Consistent edge language: defaultně bez tvrdého rámečku; hranice dělá vnitřní světelný edge a jemný shadow.
- Reusable hover logic: hover mění světlo a akcent, ne celý charakter karty.

## Exact Token System

### Core surface tokens

```css
--card-radius-sm: 10px;
--card-radius-md: 14px;
--card-radius-lg: 18px;

--card-bg-base:
  linear-gradient(180deg, rgba(25, 31, 40, 0.94), rgba(14, 18, 26, 0.96));
--card-bg-muted:
  linear-gradient(180deg, rgba(21, 26, 34, 0.9), rgba(12, 16, 23, 0.94));
--card-bg-elevated:
  linear-gradient(180deg, rgba(31, 38, 49, 0.96), rgba(18, 22, 30, 0.98));
--card-bg-interactive:
  linear-gradient(180deg, rgba(29, 35, 45, 0.95), rgba(16, 20, 28, 0.97));
--card-bg-glass:
  linear-gradient(180deg, rgba(34, 40, 50, 0.82), rgba(16, 20, 28, 0.88));

--card-edge-soft: inset 0 1px 0 rgba(255, 242, 214, 0.05);
--card-edge-strong: inset 0 1px 0 rgba(255, 239, 208, 0.08);

--card-border-soft: rgba(255, 220, 170, 0.08);
--card-border-mid: rgba(255, 220, 170, 0.14);

--card-shadow-soft: 0 10px 24px rgba(2, 6, 12, 0.18);
--card-shadow-mid: 0 14px 28px rgba(2, 6, 12, 0.24);
--card-shadow-strong: 0 18px 34px rgba(2, 6, 12, 0.3);

--card-accent-gold: #d8aa57;
--card-accent-violet: #a884f6;
--card-accent-red: #d16464;
--card-accent-blue: #5e9fe0;
--card-accent-green: #5ea97e;
--card-accent-slate: #6b7f95;
```

### Layout tokens

```css
--card-padding-compact: 0.5rem;
--card-padding-base: 0.68rem;
--card-padding-roomy: 0.86rem;

--card-gap-tight: 0.24rem;
--card-gap-base: 0.42rem;
--card-gap-roomy: 0.62rem;
```

## Five Card Variants

### 1. `ui-card--base`

Použití:

- běžné informační karty,
- `panel-stack section`,
- `city-stats-grid article`,
- `messages-detail-card` jako default bez semantiky.

Charakter:

- nejběžnější povrch,
- lehce oddělený od panelu,
- bez výrazného akcentu.

### 2. `ui-card--muted`

Použití:

- sekundární seznamové řádky,
- `city-side-info li`,
- `city-resource-stock-list li`,
- neaktivní položky detail panelů.

Charakter:

- tmavší a méně kontrastní než base,
- čitelný, ale nehlásí prioritu.

### 3. `ui-card--elevated`

Použití:

- hlavní KPI,
- důležité souhrny,
- `resource-card`,
- top-level military summary,
- spotlight a hlavní dashboard cards.

Charakter:

- světlejší povrch,
- silnější edge a shadow,
- pocit, že karta sedí výš než běžné sekce.

### 4. `ui-card--interactive`

Použití:

- klikatelné karty a targety,
- `commands-item`,
- `military-unit-card`,
- `messages-report-item`.

Charakter:

- stejný základ jako base/elevated,
- má definovaný hover/focus stav,
- má accent rail nebo glow při aktivaci.

### 5. `ui-card--semantic`

Použití:

- semantic varianty pro battle/messages/profile.

Charakter:

- background zůstává v card systému,
- semanticita jde přes horní accent rail, čísla, ikony a jemnou radial vrstvu,
- nikde nevzniká úplně jiná barevná plocha přes celou kartu.

## First Migration Wave

První vlna má remapovat tyto rodiny:

### `resource-card`

Map to:

- base variant: `ui-card ui-card--elevated ui-card--resource`

Notes:

- levý accent rail může zůstat, ale jen jako role detail,
- pravý sloupec (`resource-card-right`) nesmí být vizuálně úplně jiná karta,
- v HUD režimu je možné používat `compact` density token, ne jiný background.

### `panel-stack section`

Map to:

- base variant: `ui-card ui-card--base`

Notes:

- tady má být nejvíc klidu,
- sekce nemají soutěžit s vnitřními kartami,
- panel surface musí být tmavší než samotná sekce.

### `commands-item`

Map to:

- base variant: `ui-card ui-card--interactive`

Notes:

- hover a focus mají být jednotné napříč commands,
- `is-danger` a podobné stavy řešit přes accent token, ne jiný typ backgroundu.

### `military-unit-card`

Map to:

- base variant: `ui-card ui-card--interactive ui-card--elevated`

Notes:

- armádní jednotky mají být čitelné a “sběratelské”, ale ne tabulkové,
- mercenary overlay zůstane samostatná funkční vrstva nad standardním povrchem.

## Second Migration Wave

### Battle

`battle-army-card` má mít jeden card surface a semantic rail:

- attacker: red accent rail + red secondary text
- defender: blue accent rail + blue secondary text
- support: slate/blue accent rail

Background nemá být úplně jiný mezi variantami, jen lehce tónovaný.

### Messages

`messages-report-item` a `messages-detail-card` mají být:

- `messages-report-item`: `ui-card--interactive`
- `messages-detail-card`: `ui-card--base`
- `is-active`: elevated + accent rail
- kingdom invite: semantic gold accent, ne nový separátní gradient

### Profile

`player-profile-stat-card` má používat:

- default: `ui-card--muted`
- main stats: `ui-card--elevated`
- combat stats: semantic accent per stat type

## Selector Strategy

Nejefektivnější cesta není přepsat všechno jedním globálním selektorem. Lepší je:

1. zavést tokeny do `.game-page`,
2. přidat draft utility/selectors pro `.ui-card*`,
3. remapovat existující rodiny po blocích,
4. po každé vlně odmazat staré background/border definice.

To sníží selector wars s `dark-medieval`.

## Implementation Strategy

### Phase 1

- vytvořit token layer,
- připravit utility card variants,
- namapovat `resource-card`, `panel-stack section`, `commands-item`, `military-unit-card`.

### Phase 2

- semantic variants pro `battle-*`, `messages-*`, `player-profile-*`,
- převést active/selected/warning/danger stavy na accent systém.

### Phase 3

- odstranit staré globální `section/article/li` skin override,
- ponechat skin jen jako barevné přepnutí tokenů.

## Acceptance Criteria

- Každá karta v projektu spadá do jedné z 5 variant.
- Žádná sekce nepotřebuje unikátní gradient jen kvůli tomu, aby byla vidět.
- Dark-medieval skin mění tokeny, ne strukturu card systému.
- Hover/focus/active stavy jsou shodné napříč rodinami.
- Semanticita je čitelná přes akcent, ne přes jiný background pro každou sekci.

## Recommendation

Pokud to budeš chtít schválit k implementaci, doporučený první runtime krok je:

1. vytvořit token layer,
2. přemapovat `resource-card`, `panel-stack section`, `commands-item`, `military-unit-card`,
3. teprve potom řešit battle/messages/profile.
