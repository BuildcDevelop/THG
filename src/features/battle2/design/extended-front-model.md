# Battle2: rozšířený model fronty a bočního tlaku

Tento návrh je izolovaný pro `src/features/battle2/` a nemá míchat nový simulátor s aktuální hrou. Slouží jako kontrakt před větší implementací bojiště.

## Cíl

- Udržet bitvu čitelnou, tahovou a vizuálně živou.
- Zachovat pravidlo, že standardně bojuje jen frontová linie; střelci jsou výjimka.
- Přidat smysluplný boj o boky bez teleportování útoků mimo pozici.
- Donutit hráče rozhodovat, kam přesně soustředí sílu: levé křídlo, střed, pravé křídlo.

## Doporučený model

### 1. Strategické rozdělení armády

- Armáda má tři strategické směry tlaku: `left wing`, `center`, `right wing`.
- Každý směr má vlastní frontu, hlavní linii a rezervu.
- Síla se nepočítá jen součtem všech živých jednotek, ale i tím, kde jsou skutečně navázané do boje.

### 2. Taktické rozšíření bojiště během bitvy

- Před bitvou zůstává editor jednoduchý: stávající 3 sektory `left`, `center`, `right`.
- Po spuštění bitvy se bojiště runtime rozšíří o dva boční bojové bloky:
  - `far_left`
  - `far_right`
- Tyto bloky reprezentují hlubší obchvat nebo boční charge, ne plnohodnotnou čtvrtou a pátou linii armády.
- `far_left` patří do levého křídla, `far_right` do pravého křídla.

### 3. Pohyb mezi bloky

- Pěchota může změnit maximálně 1 blok za kolo.
- Jízda může změnit maximálně 2 bloky za kolo.
- Střelci se standardně nepřesouvají do bočního charge prostoru; jejich hlavní role je palba z hlavní nebo záložní linie.
- Přesun do bočního bloku musí být explicitní rozkaz, ne automatika.

### 4. Kdo smí bojovat

- Melee standardně bojuje jen z `front`.
- `main` a `reserve` nebojují, dokud nedostanou rozkaz k podpoře, přesunu nebo převzetí proraženého místa.
- Střelci mohou pálit z `main` a `reserve`, podle výhledu a cíle.
- Jednotka nesmí útočit mimo dosah svého sektoru jen proto, že na mapě existuje nepřítel.

### 5. Legální směry útoku

- Čelní útok: stejný sektor proti sobě.
- Boční kontakt: sousední sektor, pokud je fronta fyzicky sousední.
- Obchvat přes `far_left` nebo `far_right`: jen pokud se tam jednotka skutečně přesunula.
- Není dovoleno:
  - přeskočit přes střed do opačného křídla v jednom tahu,
  - útočit z druhé či třetí řady bez navázání do fronty,
  - ručně zadat cíl, který daný slot nemůže fyzicky kontaktovat.

### 6. Cena za útok do boku

- Pokud frontová jednotka odkloní tlak do boku, oslabí svůj čelní sektor.
- To se má projevit minimálně ve třech veličinách:
  - nižší `front defense`,
  - vyšší riziko `flank exposed`,
  - nižší šance udržet linii při čelním protiútoku.
- Prakticky: jednotka může získat bonus na boční zásah, ale vytváří mezeru nebo měkčí čelo ve svém původním směru.

### 7. Nahrazování padlých

- Automatické doplňování fronty nechceme.
- Když frontový slot padne nebo se stáhne, vznikne `breach`.
- `main` nebo `reserve` mohou díru převzít jen pokud:
  - dostaly explicitní rozkaz,
  - nebo už byly v minulém kole commitnuté do přesunu na tuto pozici.
- Tím zůstane důležitá velitelská volba: držet zálohu, nebo ji poslat zalepit trhlinu.

### 8. Třísměrný tlak místo „globální síly armády“

- Každé křídlo má mít vlastní lokální skóre tlaku.
- Doporučené runtime veličiny:
  - `committedPower`
  - `frontIntegrity`
  - `flankRisk`
  - `reinforcementETA`
- Konec bitvy nebo kolaps linie se pak nevyhodnocuje jen podle celkového HP, ale i podle toho, zda se zhroutil střed nebo jedno křídlo.

## UI a animace

- Během `impact` fáze se obě frontové řady vizuálně přisunou ke clash linii.
- Při hoveru nebo výběru se má ukazovat:
  - aktuální cíl,
  - zamýšlený cíl,
  - směr přesunu nebo obchvatu.
- Boční bloky se mají zobrazit až v aktivní bitvě, aby příprava armády zůstala přehledná.
- Tooltip má vždy vysvětlit, proč je cíl neplatný:
  - mimo kontakt,
  - zadní řada bez přesunu,
  - cíl už není v boji,
  - chybí volný bod velení.

## Doporučený rollout

### Fáze 1

- Zpřísnit validaci ručních cílů a rozkazů.
- Vizuálně přiblížit fronty.
- Nechat stávající 3x3 model stabilní.

### Fáze 2

- Přidat runtime-only `far_left` a `far_right`.
- Zavést přesunové rozkazy podle archetypu a rychlosti.

### Fáze 3

- Přidat alokaci tlaku pro `left wing / center / right wing`.
- Započítat oslabování čela při bočním commitnutí.

### Fáze 4

- Přidat breach/reinforcement flow bez automatického doplňování.
- Teprve potom ladit AI logiku nepřítele pro boční charge a reakce na kolaps křídel.

## Co implementovat až potom

- Detailní AI pro obchvaty.
- Pokročilé morální efekty podle směru tlaku.
- Napojení do hlavní hry a reálných armádních dat.

Nejdřív má být robustní lokální simulátor s jasným kontraktem pohybu, kontaktu a tlakových rozhodnutí.
