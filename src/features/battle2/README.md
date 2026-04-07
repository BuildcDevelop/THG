# Battle 2.0 Feature Root

Tato slozka je izolovany workspace pro novy battle simulator.

## Hranice feature

- Neimportovat nic z `src/pages/GamePage.tsx`.
- Nepouzivat `src/api/gameApi.ts` pro V1 simulator.
- Nepridavat polling, backend fetch ani vazbu na tick.
- Drzet cely simulator v lokalnim state a seedovatelnych fixture datech.
- Vsechny contracts, engine types, fixtures a UI komponenty drzet uvnitr teto slozky.

## Doporucena struktura

- `pages/` route entry pro simulator
- `engine/` cisty simulacni model bez Reactu
- `state/` lokalni simulator state a reducer
- `data/` fixture jednotky, enemy templates a scenario seeds
- `ui/` feature-specificke komponenty

## V1 scope

- builder hracovy armady
- random enemy deployment
- start / pause / reset / new battle
- round timeline
- warning feed
- final report
