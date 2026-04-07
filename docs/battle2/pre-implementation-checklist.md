# Battle 2.0 Pre-Implementation Checklist

Tento checklist ma snizit pocet rozhodnuti, ktera by jinak vznikala az behem implementace.

## Co ma byt zamcene pred psanim logiky

- feature scope V1 a V1.1
- jednoznacne nazvy typu, stavu, akci a eventu
- slot topology a engagement rules
- command model a command point economy
- battle pace, soft end a hard end
- role jednotlivych kvalit jednotek
- ranged doctrine a fallback targeting
- enemy generator rules a template seznam
- seed format pro reset a replay
- output contracts pro round log a final report

## Co ma byt pripraveno pred UI pracemi

- wireframe builderu
- wireframe battlefield view
- wireframe warning feedu
- wireframe final reportu
- seznam stavu, ktere maji vlastni vizualni highlight
- seznam inputu, ktere jsou dostupne behem boje

## Co ma byt pripraveno pred engine pracemi

- fixture unit templates
- fixture player army
- enemy template fixtures
- aspon 3 scenare pro regression simulace
- definice deterministic seed flow
- definice reset snapshotu

## Co ma byt pripraveno pred iteraci balancu

- metriky pro prumerny pocet kol
- metriky pro average surviving HP
- metriky pro morale collapse timing
- metriky pro charge value
- metriky pro ranged pressure value
- metriky pro retreat viability

## Implementation order

1. contracts a constants
2. fixture data a enemy generator
3. pure sim core
4. local simulator state
5. battle page shell
6. builder + run controls
7. timeline, warnings, final report
8. visual polish a debugging overlays
