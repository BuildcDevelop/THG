# Battle 2.0 Field Battle Simulator Spec

Pracovni specifikace pro prvni iteraci izolovaneho battle simulatoru.
Tento dokument zamyka hlavni rozhodnuti pred implementaci UI a sim modulu.

## 1. Locked Decisions

- Jedna armada ma jednoho generala.
- General ma max 3 perk body celkem.
- Perky jsou armadni, ne slotove.
- V1 simulator resi pouze boj na bojovem poli.
- Jeden slot = jedna bojova skupina.
- Hrac sklada vlastni armadu rucne do 9 slotu.
- Nepritel se generuje nahodne, ale validne.
- Bitva se sama hybe mezi command okny. Hrac nerezii kazdy slot v kazdem kole.
- Simulator musi umet:
  - slozit armadu
  - vygenerovat novou bitvu
  - spustit bitvu
  - pozastavit ji
  - resetovat stejnou bitvu
  - vygenerovat novou bitvu se stejnym hracem a novym nepritelem

## 2. Battle Pace And Duration

- 1 kolo reprezentuje priblizne 12 sekund bojoveho casu.
- Damage za jedno kolo ma byt nizsi, aby se linie nejprve lamala moralne a prostorove, ne okamzitym wipe.
- Bezna bitva nema skoncit za 2 kola, ale ani se nesmi tahnout 20 kol.

### Cilove rozsahy

- mala bitva: 5 az 7 kol
- standardni bitva: 6 az 10 kol
- velka nebo houzevna bitva: 11 az 14 kol
- tvrdy limit: 16 kol

### Cilovy hracsky cas

- mala bitva: 2 az 3 minuty
- standardni bitva: 3 az 5 minut
- velka bitva: 5 az 7 minut

Poznamka:
- realny hracsky cas je delsi nez simulovany bojovy cas, protoze simulator muze pauzovat na command oknech, warning eventech a detailu kola

## 3. Dynamic Battle End

Bitva nekonci fixnim poctem kol, ale stavem bojiste.

### Soft end check

Od konce 4. kola se po kazdem kole vyhodnoti tlak na armadni retreat.
Strana je v kolapsu, pokud plati aspon 2 z techto 4 podminek:

- efektivni HP armady kleslo pod 40 % startu
- prumerna moralka armady klesla pod 30
- strana ztratila stred a alespon jedno kridlo
- 3 nebo vice slotu je ve stavu `broken`, `routing`, `withdrawn` nebo `destroyed`

### End states

Bitva skonci, kdyz nastane jedna z techto situaci:

- jedna strana vyda army retreat a prezije withdrawal resolution
- jedna strana nema zadny combat-ready front/main slot a nema rezervu, ktera by mohla vstoupit do boje v pristim kole
- jedna strana ma mene nez 2 combat-ready sloty celkem
- dojde 16. kolo a slabsi strana je vynucena k retreat podle battle score

### Withdrawal resolution

Po vydani army retreat bitva nekonci instantne.
Bezi jeste 1 az 2 withdrawal kola, kde se rozhodne:

- kolik vojaku ustoupi
- kolik jich padne pri odpoutani
- kolik jich bude pozdeji znaceno jako escaped / captured hook

## 4. Command Model

Tohle je hlavni vrstva, ktera z toho dela "sachovnici", ne spam klikani.

### Pre-battle decisions

Pred startem bitvy hrac urcuje:

- rozlozeni 9 slotu
- stance slotu
- armadni plan
- ranged doctrine pro strelecke sloty
- generala a jeho 3 perk body

### Army plans

V1 staci 4 armadni plany:

- `standard`: bez plosnych bonusu, nejbezpecnejsi default
- `pressure`: +utocny tlak, +stamina cost, AI casteji tlaci oslabeny sektor
- `hold_line`: +obrana, +morale recovery, AI mene riskuje charge
- `full_retreat`: vsechny sloty se snazi dostat do `withdraw` / `routing escape`

### In-battle decisions

Za beznych podminek hrac nedava 9 rozkazu za kolo.
Dostava omezeny pocet zasahu do bitvy.

### Command points

- hrac dostane 1 command point na zacatku kola
- muze drzet max 2 banked command points
- kriticky event muze dat 1 docasny reaction point, ktery se neprenasi dal

### Co stoji 1 command point

- zmenit akci jednoho slotu pro dalsi kolo
- zmenit cil jednoho streleckeho slotu
- commitnout jednu rezervu
- naridit local withdraw konkretniho slotu
- naridit re-form konkretniho slotu
- vyvolat army retreat

### Default behavior bez zasahu hrace

Kdyz hrac nic neudela:

- slot jede podle armadniho planu
- AI lokalne reaguje podle stavu slotu
- system generuje warningy jen pri dulezitych okamzicich

### Simulator-only debug mode

Protoze chceme iterovat simulator, ne jen finalni game rules:

- simulator muze mit debug prepinac `unlimited commands`
- defaultne je vypnuty
- pri ladeni umozni rychle testovat akce bez command limitu

## 5. Battlefield Topology

Bojiste ma 9 slotu na kazde strane:

- `left_front`, `center_front`, `right_front`
- `left_main`, `center_main`, `right_main`
- `left_reserve`, `center_reserve`, `right_reserve`

### Engagement rules

- front slot je primarni kontaktni vrstva
- main slot podporuje stejny sektor a automaticky nastupuje dopredu, kdyz front slot odpadne
- reserve slot je mimo primy melee kontakt, dokud neni commitnut

### Sector adjacency

- `left` sousedi jen s `center`
- `center` sousedi s `left` a `right`
- `right` sousedi jen s `center`

### Front collapse

Kdyz front slot sektoru odejde z boje:

- main slot stejneho sektoru se muze posunout dopredu v pristim kole
- pokud se neposune nikdo, sektor je `open`
- sousedni nepratelske sloty mohou ziskat `flank_exposed`

### Reserve commit

- rezerva do stejneho sektoru vstoupi v pristim kole
- rezerva do sousedniho sektoru vstoupi v pristim kole, ale bez plneho shock bonusu, pokud nesla do otevreneho flanku
- cavalry z rezervy muze dostat `fresh engage` bonus

## 6. Slot State Machine

Kazdy slot ma explicitni stav:

- `ready`
- `engaged`
- `shaken`
- `broken`
- `routing`
- `withdrawn`
- `destroyed`

### Prakticky vyznam stavu

- `ready`: slot funguje normalne
- `engaged`: slot je v melee kontaktu
- `shaken`: zhorsena moralka, horsi vykon, roste sance na dalsi kolaps
- `broken`: slot uz spis preziva nez bojuje
- `routing`: slot ztraci kontrolu a snazi se uteci
- `withdrawn`: slot opustil hlavni kontakt, muze se zkusit reformovat
- `destroyed`: slot je mimo bitvu

### Doplnujici thresholdy

- `shaken` obvykle pri moralce pod 45
- `broken` obvykle pri moralce pod 25
- `routing` pri moralce pod 10 nebo pri kombinaci `broken` + velmi nizke HP
- `fatigued` neni samostatny stav, ale modifikator pri staminy pod 40

## 7. Unit Identity

### Archetypes

- Infantry = anchor a kontrola linie
- Archers = attrition, pressure, finishing tool
- Cavalry = shock, flank, pursuit

### Qualities

#### Levy

- levna masa
- vysoke pocty
- nizka disciplina a moralka
- slaby reform a slaba reakce pod tlakem

#### Retainer

- otevrene pole a jadro armady
- nejvyrovnanejsi role
- nejlepsi kombinace reakce, stability a reformu

#### Garrison

- obranny specialista
- silnejsi `hold` a `brace`
- lepsi endurance pri drzeni sektoru
- slabsi `advance`, horsi pursuit a pomalejsi preskupeni
- musi byt citelne lepsi v boji o drzeny bod nez v otevrenem poli

#### Mercenary

- vysoky tlak a burst
- vyssi morale pressure
- vyssi stamina drain
- horsi dlouhodobe udrzeni tempa nez retainer
- ekonomicky drahy a bojove nebezpecny

## 8. Actions And Counter Loops

V1 zamkne tyto akce:

- `hold`
- `advance`
- `brace`
- `volley`
- `focus_fire`
- `charge`
- `withdraw`
- `re-form`

### Counter loops

- `brace` je odpoved na `charge`
- `focus_fire` je odpoved na slot s nizkou moralkou nebo exposed flank
- `withdraw` je odpoved na grind nebo reset cavalry
- `re-form` vraci slot do bojeschopneho stavu, ale stoji tempo
- `charge` je spike, ne default melee rezim

## 8.1 Temporary Advantage

`temporary_advantage` je kratky, ale dulezity stav.
Prave on dela bitvu dynamickou a vizualne zajimavou.

Vznikne typicky kdyz:

- slot zasahne exposed flank
- fresh cavalry narazi do shaken nebo broken cile
- obranci se rozsype sousedni sektor
- cil withdrawuje a je pod tlakem
- rezerva vstoupi do otevreneho sektoru ve spravny cas

Efekty:

- kratky boost morale damage
- plna aktivace charge / penetration bonusu
- silnejsi sance na `line_break`
- vyrazny UI highlight a warning

## 9. Ranged Targeting

Nahodny target je slaby design. Pro strelce bude lepsi doctrine + fallback logika.

### Pre-battle ranged doctrine

Kazdy strelecky slot muze mit:

- `counter_archers`
- `support_center`
- `finish_broken`
- `auto`

### Auto priority

Pokud ma strelec validni cile, hleda v tomto poradi:

1. nepratelsky archer ve stejnem nebo sousednim sektoru
2. slot s nizkou moralkou
3. slot, na ktery uz miri allied focus fire
4. front-most nepratelsky slot, ktery tlaci vlastni sektor

### Line of fire

- front archers mohou strilet, ale jsou nejzranitelnejsi a dostavaji penalizaci do preziti
- main archers mohou strilet do sveho sektoru bez postihu
- strelba do sousedniho sektoru dostava lehkou penalizaci
- reserve archers mohou strilet jen tehdy, pokud nejsou zcela blokovani vlastni hlavni linii
- rezervni a hlavni sloty nejsou validni priorita pro ranged focus, pokud je pred nimi zdravy front slot, ktery kryje sektor

### Fallback

- kdyz neni dostupny preferovany cil, strelec prejde na dalsi validni prioritu
- kdyz neni zadny validni cil, nestreli a simulator vyhodi warning

### Warning

Pouzij hlaseni typu:

- `Archers have no preferred target`
- `Enemy has no ranged units; archers switched to fallback`
- `No valid ranged target in lane`

## 10. Enemy Random Deployment

Nepritel se negeneruje ciste random. Pouziva validacni logiku.

### Generator rules

- archers nejsou v predni linii, pokud existuje jina moznost
- cavalry preferuje kridla a rezervu
- infantry a garrison drzi front/main
- pokud je armada obranna, garrison preferuje stred a front/main
- mercenaries preferuji shock role nebo ranged pressure role podle sablony

### Generator templates

V1 staci 4 sablony:

- `balanced`
- `pressure`
- `bowline`
- `cavalry_wing`

### Seed

Kazda vygenerovana bitva ma seed.
To umozni:

- reset stejne bitvy
- porovnavat balanc po zmenach
- opakovat edge case

## 11. Simulator UI

Simulator musi byt dobry pro hrani i pro ladeni.

### Layout

- leva cast: setup hracovy armady a battle controls
- stred: hlavni bojiste 3x3 vs 3x3
- prava cast: detail slotu, turn log, warning feed

### Main controls

- `Start Battle`
- `Pause`
- `Resume`
- `Step Round`
- `Speed x1/x2/x4`
- `Reset Battle`
- `New Battle`
- `Randomize Enemy`

### Visual language

Bitva musi byt citelna i zajimava na pohled:

- pulse na slot pod tlakem
- modry pulse na `charge ready`
- cerveny crack efekt na `broken`
- jantarovy tlak na `shaken`
- sipky a trajektorie pro `volley` a `focus_fire`
- impact flash pro `charge`
- highlight pro `temporary advantage`

### Playfield protection

Podle `game-ui-frontend`:

- stred bojiste musi zustat citelny
- dlouhe texty patri do side panelu
- persistentni HUD ma byt nizky a ne dashboardovy

## 12. Event And Report Layer

Aby hrac pochopil proc se bitva zlomila, simulator musi produkovat eventy, ne jen cisla.

### Core event types

- `engage`
- `volley`
- `focus_fire`
- `charge`
- `brace`
- `line_break`
- `flank_exposed`
- `temporary_advantage`
- `withdraw`
- `re-form`
- `rout`
- `retreat_called`
- `no_ranged_target`

### Per-round output

Kazde kolo vraci:

- HP delta po slotech
- morale delta po slotech
- stamina delta po slotech
- ammo delta po slotech
- list eventu
- human-readable warning summary

### Final report output

Po bitve simulator vrati:

- vysledek bitvy
- pocet kol
- ztraty obou stran
- surviving slots
- withdrawn slots
- routed slots
- general outcome hook
- escaped / captured hook

## 13. Technical Boundaries

Podle `web-game-foundations` musi byt sim oddelena od UI.

### Sim owns

- slot state
- morale
- stamina
- ammo
- targeting
- event resolution
- battle outcome

### UI owns

- battlefield presentation
- timing, pause, speed
- panels, warnings, replay
- army builder controls

### Required engine properties

- deterministic se seedem
- serializable input/output
- step-by-step resolution po kolech
- replayable z ulozeneho battle inputu

## 14. V1 And V1.1 Boundaries

### V1

- field battle only
- 9-slot deployment
- one general per army
- perk body max 3
- random enemy deployment
- dynamic end of battle
- reset + new battle
- per-round log
- final battle report

### V1.1

- prisoners / escaped split
- general capture outcome
- fortified sector scenario toggle
- richer AI styles by general

## 15. Recommended Next Build Step

Po teto specifikaci dava smysl implementovat v tomto poradi:

1. seedable sim core bez animaci
2. battle simulator page s builderem a random enemy generator
3. round timeline + warning feed
4. visual combat presentation
