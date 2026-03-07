# Optimalizace a vykonove guardrails

Tento dokument je provozni playbook pro The Last Dominion. Cilem je zrychlovat hru bez rozbijeni herni logiky, backend timing modelu a uzivatelskeho chovani.

## 1. Hlavni problemy dnes

- `GamePage.tsx` je monolit. Pri zmene velke casti `gameState` se zbytecne prepocitava moc UI.
- Mapa je DOM-heavy. Markery, overlaye, ikonky a minimapa vytvareji hodne React node.
- Polling bezi paralelne na vice mistech. Kdyz se prida dalsi interval bez kontroly, klient i server se snadno zahlti.
- Backend stale nese riziko `tick-on-read`, tedy prepocitavani hry pri cteni dat.
- Skryta nebo vedlejsi okna umi zustat "ziva" a dal renderovat nebo tahat data.

## 2. Co musi mit kazda nova feature pred implementaci

Pred psanim kodu vzdy napis nebo aspon interne urci techto 6 bodu:

1. `Uzivatelsky cil`: co hrac realne ziska.
2. `Autoritativni stav`: kde je pravda, zda na serveru, v lokalnim UI nebo v odvozene cache.
3. `Fetch model`: odkud se data berou, jak casto a co zpusobi refresh.
4. `Render dopad`: ktere panely, seznamy nebo mapove vrstvy se prekresli.
5. `Riziko regrese`: co muze feature rozbit v ekonomice, rozkazech, ticku nebo synchronizaci.
6. `Mereni`: co zmerit pred a po zmene.

Pokud tyto body nejdou popsat jednou kratkou sekci, je feature navrzena prilis siroce a ma se rozdelit.

## 3. Guardrails pro frontend

- Nevkladej nova velka data do globalniho `gameState`, pokud nejsou potreba ve vice panelech zaroven.
- Nepridavej novy globalni polling bez jasneho duvodu. Skryty panel ma idealne delat `0` requestu.
- Neprivazuj lokalni UI interakce na sit. Zoom, pan, hover, select a drag-and-drop musi byt lokalni.
- Nedrz vice zdroju pravdy pro stejna data. Server je autorita, klientska data jsou snapshot, cache nebo lokalni draft.
- Tazke panely lazy-loaduj a pri skryti je pokud mozno unmountuj nebo alespon "freeze".
- Nedelej drahe `.map()`, `.filter()` a `.sort()` primo v render vetvich, kdyz zavisi na velkych polich. Presun je do memoizovane pripravy se stabilnimi vstupy.
- Nepropojuj stav mapy, profilu, reportu a prikazu vice, nez je nutne. Kdyz se zmeni jedno, nesmi se zbytecne hybat vse.
- Kdyz seznam nebo grid preroste rozumnou mez, pouzij virtualizaci nebo jinou redukci poctu DOM node.

## 4. Guardrails pro mapu

- Zoom a pan nesmi spoustet sitove requesty.
- Mapova data musi zustat oddelena od detailu vybraneho lena.
- Hover, preview, range highlight a command preview musi byt odvozene z jiz nactenych dat.
- Pokud pocet markeru nebo overlayu dale poroste, preferovany cil je `canvas` vrstva pro body a React pouze pro aktivni overlaye.
- Minimapu ber jako samostatny renderer s co nejmensim poctem node.
- Kdyz mapa potrebuje dalsi vrstvu, nejdriv urci, zda to ma byt:
  - lokalni vizualni vrstva,
  - odvozena vrstva z existujicich dat,
  - nebo nova sitova vrstva.

## 5. Guardrails pro backend

- Nove read endpointy nesmi potichu spoustet herni tick.
- Vsechna tezka svetova data oddel od detailu konkretniho hrace nebo konkretniho panelu.
- Kdyz feature skenuje vice len, hracu nebo rozkazu, zkontroluj indexy a rozsah SQL dotazu.
- Nevracej do odpovedi data, ktera panel zrovna nepouziva.
- Preferuj pripravu lehkych read modelu pred tim, aby frontend skladal vse z jedne obri odpovedi.
- Feature, ktera pridava automatizaci nebo periodicky proces, musi mit:
  - jasny interval,
  - tvrdy limit,
  - audit log nebo jiny dohled,
  - a definovany skip/fallback stav.

## 6. Bezpecne poradi optimalizace

Pouzivej toto poradi. Neskakej rovnou na big-bang redesign.

1. `Mer a zmensi zbytecne requesty`
- skryte panely bez pollingu,
- summary misto plnych seznamu,
- on-demand data.

2. `Oddel data podle domen`
- mapa zvlast,
- reporty zvlast,
- komunikace zvlast,
- tezke panely jen kdyz jsou otevrene.

3. `Rozsekni stav a render hranice`
- mensi slices stavu,
- mene globalnich invalidaci,
- mene plosnych rerenderu.

4. `Teprve potom prepisuj renderery`
- mapa na canvas,
- virtualizace,
- panel lifecycle.

5. `Nakonec sahni na timing model enginu`
- odstranit `tick-on-read`,
- oddelit engine od request/response toku,
- pridat cache per world/tick.

## 7. Priorita zlepseni podle potencialu

### Nizsi az stredni potencial

1. Omezit background polling mimo aktivni herni panel.
2. Summary fetch misto plnych seznamu tam, kde hrac necte detail.
3. Lazy-load routy a tezke panely.
4. Unmount nebo freeze neaktivni okna.

### Vysoky potencial

5. Rozdelit `GamePage` na mensi stavove a render moduly.
6. Drzet data pro mapu, reporty, komunikaci a kingdom oddelene.
7. Zavest query/cache vrstvu, aby stejna data necestovala zbytecne znovu.

### Nejvyssi potencial

8. Odstranit `tick-on-read` z ctecich cest.
9. Cachovat svetova data per world/tick.
10. Prevest mapu z DOM-heavy pristupu na lehci renderer.
11. Dlouhodobe oddelit gameplay engine od HTTP request cyklu.

## 8. Vykonove budgety

Pouzivej tyto limity jako pojistku. Kdyz je feature porusi, musi to byt vedome popsane.

- Nova feature nesmi pridat dalsi globalni interval bez duvodu a bez viditelneho prinosu.
- Skryty panel nema delat sitovou aktivitu, pokud to neni jeho primarni funkce.
- Lokalne interakce mapy nesmi spoustet request.
- Hlavni state payload nema rust o vice nez `10 %` bez vyslovneho duvodu.
- Nova feature nema zvysit pocet renderovanych mapovych node, pokud stejny efekt jde udelat lokalni vrstvou nebo agregaci.
- Nove automatizace musi mit rate-limit, skip logiku a audit.

## 9. Definition of done pro vykonove citlive zmeny

Pred mergem musi byt hotove:

1. `Pred/po mereni`
- velikost payloadu,
- pocet requestu za minutu,
- pocet panelu nebo vrstev, ktere se rerenderuji,
- backend dopad na tick nebo tezke SQL.

2. `Regresni ochrana`
- existujici testy musi projit,
- pokud feature sahla na ekonomiku, rozkazy, logistiku nebo tick, dopln test scenare.

3. `Manualni overeni`
- prihlaseni,
- prepnuti sveta,
- otevreni/zavreni dotcenych panelu,
- jedna typicka akce hrace,
- jeden edge case.

4. `Popis kompromisu`
- co se zrychlilo,
- co je stale limit,
- co bude dalsi krok, pokud to nestaci.

## 10. Pracovni sablona pro kazdou dalsi feature

Pouzij tento mini template:

```md
## Feature
- Cil:
- Autoritativni stav:
- Fetch model:
- Dotcene panely:
- Riziko regrese:
- Mereni pred:
- Ocekavany dopad:
```

Pokud feature meni mapu, polling, ekonomiku, logistiku, rozkazy, komunikaci nebo backend timing, bez teto sablony se nema implementovat.
