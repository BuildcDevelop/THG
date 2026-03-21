# Verejny poradek, armada vsech len, mapa a queue v1 - acceptance scenare

Tento dokument navazuje na:

- `arch/verejny-poradek-armada-api-spec-v1.md`
- `arch/verejny-poradek-armada-db-spec-v1.md`
- `arch/verejny-poradek-armada-mapa-implementacni-milniky-v1.md`

Cil:

- dodat konkretni scenare pro implementaci a QA,
- dodat konkretni scenare i pro mapovy ownership/diplomacy kontrakt,
- overit UX, data-flow i guardrails,
- zachytit edge cases pred runtime implementaci.

## 1. Verejny poradek

### PO-001 Badge pri `100 %`

Precondition:

- hrac ma `publicOrder = 100`

Kroky:

1. otevrit hlavni herni obrazovku

Expected:

- badge je vedle aktivniho lena,
- je videt jen ikona,
- procento se nezobrazuje,
- tooltip rika, ze rise je stabilni a bez postihu.

### PO-002 Badge pri `99-50 %`

Precondition:

- hrac ma `publicOrder = 72`

Expected:

- badge ukazuje ikonu i `72 %`,
- tonalita je neutralni,
- tooltip ukazuje `+2 % / hod`,
- zadny debuff neni aktivni.

### PO-003 Warning pasmo `49-30 %`

Precondition:

- hrac ma `publicOrder = 44`

Expected:

- badge je vyraznejsi,
- tooltip jasne rika, ze rytirsky stav je docasne uzavren,
- recruit rytire je blokovan s konkretnim duvodem.

### PO-004 Critical pasmo `29-0 %`

Precondition:

- hrac ma `publicOrder = 12`

Expected:

- badge je cerveny nebo obdobne kriticky zvyrazneny,
- tooltip rika, ze nabor, vystavba a produkce jsou zpomaleny o `50 %`,
- relevantni UI mista zobrazuji tento dopad konzistentne.

### PO-005 Dobytim lena vznikne penalty event

Kroky:

1. hrac dobyde cizi leno

Expected:

- `publicOrder` klesne o nahodnych `1..25`,
- hodnota nikdy nespadne pod `0`,
- vznikne governance audit event,
- conquest report nebo activity reference zobrazi dopad.

### PO-006 Hodinova regenerace

Precondition:

- hrac ma `publicOrder = 63`

Kroky:

1. pockat jeden herni hodinovy interval nebo simulovat tick

Expected:

- `publicOrder` naroste o `2`,
- nikdy neprekroci `100`,
- aktualizuje se `updatedAt` a governance event log.

## 2. Armada vsech len

### AO-001 Nacteni panelu

Kroky:

1. otevrit `Armada`
2. prepnout na `Armada vsech len`

Expected:

- klient zavola jen `GET /api/v1/army/overview`,
- panel se vykresli bez tabulkoveho vzhledu,
- kazde leno ukazuje nazev, souradnice a jednotky.

### AO-002 Zavreny panel nedela requesty

Kroky:

1. zavrit nebo prepnout z panelu `Armada vsech len`
2. sledovat sitovou aktivitu

Expected:

- zadny background polling,
- zadne requesty na `army/overview`.

### AO-003 Garrison tooltip

Precondition:

- leno ma nenulovou posadku

Expected:

- tooltip ukazuje structured shrnuti posadky,
- nevytvari vysoky rozpadly sloupec textu,
- vizualne odpovida ostatnim funkcnim tooltipum.

### AO-004 Recruit tooltip

Precondition:

- leno ma aktivni recruit queue

Expected:

- tooltip ukazuje aktualne bezici recruit a kratky nahled dalsich polozek,
- tooltip je kratky a informativni,
- nevytvari novy sitovy request.

### AO-005 Opevneni a brana

Expected:

- kazde leno zobrazuje `Opevneni Lx` a `Brana Lx`,
- neni potreba otevirat detail lena kvuli teto informaci.

## 3. Recruit queue

### RQ-001 Nova recruit akce vstoupi do fronty

Precondition:

- leno ma platne zdroje a kapacitu

Kroky:

1. pridat dva recruity za sebou

Expected:

- prvni item je `in_progress`,
- druhy item je `queued`,
- queue indexy jsou stabilni,
- timeline se prepocita jen pro toto leno.

### RQ-002 Reorder recruit queue

Precondition:

- ve fronte jsou aspon tri itemy

Kroky:

1. presunout treti item na prvni pozici

Expected:

- poradi se zmeni,
- finish times se prepocitaji,
- nevzniknou duplicitni `queue_index`,
- ostatni lena nejsou dotcena.

### RQ-003 Cancel recruit queue item

Kroky:

1. zrusit prostredni item ve fronte

Expected:

- item prejde do `canceled` nebo je funkcne zrusen podle finalni implementace,
- zdroje se vrati dle contractu,
- timeline se prepocita pro zbytek fronty.

### RQ-004 Public order critical pasmo zpomali recruit

Precondition:

- hrac spadne do `critical` pasma

Expected:

- recruit timeline dotcenych len se prepocita dle `-50 %` rychlosti,
- nedojde k tick-on-read,
- neprepocitava se cely svet, jen dotceny hrac.

## 4. Support rebase

### SR-001 Happy path

Precondition:

- hrac ma stationed support ve vlastnim podporovanem lenu

Kroky:

1. spustit `support rebase`

Expected:

- jednotky se stanou vlastnimi jednotkami ciloveho lena,
- domovske leno se zmeni,
- movement je auditovatelne uzavren.

### SR-002 Cizi cilove leno

Kroky:

1. zkusit `rebase` na leno, ktere nepatri hraci

Expected:

- request selze s `SUPPORT_REBASE_TARGET_NOT_OWNED`,
- nedojde k zadne mutaci.

### SR-003 Nedostatek kapacity

Kroky:

1. zkusit `rebase` do lena bez dostatku populace nebo bydleni

Expected:

- request selze s odpovidajicim error code,
- jednotky zustanou stationed support.

## 5. Battle report a activity retention

### BR-001 Archivace activity nesmaze report

Precondition:

- hrac ma battle notification s navazanym reportem

Kroky:

1. archivovat notification
2. otevrit report pres `reportId`

Expected:

- report je stale dostupny,
- nezmizel s archivaci inbox reference.

### BR-002 Smazani activity nesmaze report

Kroky:

1. smazat nebo skryt notification
2. otevrit report detail prime

Expected:

- detail reportu zustane dostupny, pokud retention politika reportu stale plati.

## 6. Combat visibility edge cases

### CV-001 Scout neni bojovy garant karavany

Precondition:

- utocna armada obsahuje jen scouta a karavanu jako prezivsi nebojovou cast

Expected:

- scout sam o sobe nezajisti preziti karavany,
- report to zobrazi konzistentne.

### CV-002 Scout survival proti ne-scout obrane

Expected:

- scout pravidla se vyhodnoti oddelene od beznych bojovych ztrat,
- report shape zustane konzistentni.

### CV-003 Visibility contract

Expected:

- report ma stale stejny shape,
- neviditelne casti jsou skryte nebo nulovane konzistentne,
- nikdy ne jednou `null` a podruhe jina struktura.

## 7. Guardrails acceptance

### GR-001 Zadny novy global polling

Expected:

- po implementaci nevznikne novy globalni interval jen kvuli verejnemu poradku nebo `Armade vsech len`.

### GR-002 Main state budget

Expected:

- pridani `publicOrder` summary nenafoukne `GET /api/v1/state` vic nez je rozumne a bez potreby.

### GR-003 Canvas neni blokator funkcnosti

Expected:

- faze `canvas marker layer` je oddelena od funkcnich zmen,
- hra je plne funkcni i pred canvas prepisem,
- canvas faze pak meri:
  - FPS pri pan/zoom,
  - pocet DOM node,
  - stabilitu hover/selection parity.

## 8. Mapa - ownership a diplomacy

### MAP-001 Aktivni vlastni leno

Precondition:

- hrac ma vybrane jedno vlastni aktivni leno

Expected:

- settlement vrati `mapKind = active`,
- settlement vrati `diplomacyKind = same_player`,
- hlavni mapa i minimapa pouziji stejnou aktivni barvu,
- render se neodvozuje z klientskych poznamek ani ochrany.

### MAP-002 Ostatni vlastni leno

Precondition:

- hrac ma aspon dve vlastni lena

Expected:

- neaktivni vlastni leno vrati `mapKind = own`,
- nikdy se nezobrazi jako `active`,
- army dialog i planner ho stale berou jako vlastni cil pro `move`.

### MAP-003 Cizi hrac ve stejnem Kralovstvi

Precondition:

- viewer i cilovy hrac jsou ve stejnem Kralovstvi,
- cilove leno nepatri viewerovi

Expected:

- settlement vrati `mapKind = opponent`,
- settlement vrati `diplomacyKind = same_kingdom_foreign`,
- `commandPermissions.canMove = false`,
- `commandPermissions.canSupport = true`,
- `commandPermissions.canAttack = true`,
- cil se nikdy nikde nevykresli jako `own`,
- tooltip, army dialog i planner umi tento stav popsat bez nove legendove barvy.

### MAP-004 Diplomacie se ridi jen Kralovstvimi

Precondition:

- mezi Kralovstvimi existuje stav `ally`, `non_aggression` nebo `war`

Expected:

- `mapKind` a `diplomacyKind` se odvodi pouze z diplomatickeho stavu,
- newbie protection ani `note` nevytvori `allied`, `don` ani `enemy`,
- zmena diplomatickeho stavu se propise konzistentne na mapu, minimapu, army dialog i planner.

### MAP-005 Kralovska lena

Precondition:

- cil je kralovske leno

Expected:

- settlement vrati `mapKind = royal`,
- `royal` neni jen klientsky legend item bez serverove opory,
- target gating se ridi `commandPermissions`, ne barvou samotnou.

### MAP-006 Jeden zdroj pravdy pro target gating

Expected:

- hlavni mapa, minimapa, army target dialog a planner ctou stejne `commandPermissions`,
- nevznika situace, kdy jedna cast UI utok povoli a jina blokuje jen kvuli vlastni heuristice,
- fallback field `relation` nema vliv na finalni render ani permissions po migraci.
