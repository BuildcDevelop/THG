# Planovac - budouci nasazeni a reporty

Tento dokument doplnuje `arch/armada-a-planovac-v1-roadmap.md`.

Cil:

- zapsat rozhodnute UX a stavove detaily, ktere padly pri planovani po prvnim draftu implementace
- oddelit `v1 pouzitelnost` od `budouciho reportingu`
- nechat si zapisany smer pro dalsi chat, aby se nezapomnelo na `plan_id` a navazne souhrny

Mimo scope tohoto dokumentu:

- plny archiv planu
- samostatna epicka stranka reportu planovanych utoku
- redesign jinych panelu

## 1. Potvrzene smerovani v1

### Rezimy planneru

Planner ma mit jasne a vzajemne vylucene rezimy:

1. `draft`
2. `confirmation`
3. `active_plan`
4. `completed_stub`

Pravidla:

- pokud neexistuje aktivni serverovy plan, hrac muze vytvaret koncept
- pokud existuje aktivni serverovy plan, planner se otevira do detailu tohoto planu
- hrac nema byt defaultne v konceptu, kdyz uz aktivni plan existuje
- koncept je mozny otevrit jen explicitni akci `Upravit plan` a jen pokud to stav dovoluje
- `completed_stub` je pouze jednoducha informacni karta posledniho dokonceneho planu
- v UI se zobrazuji maximalne dva plany:
  - jeden aktivni nebo potvrzeny plan
  - jeden posledni dokonceny plan
- jakmile se dokonci dalsi plan, predchozi `completed_stub` se prepise

### Potvrzeni planu

`Stav konceptu: validni` nikdy neznamena, ze se neco samo odesle.

Spravna flow je:

1. hrac pripravi koncept
2. hrac klikne `Potvrdit plan`
3. backend vrati `validate`
4. planner se prepne do read-only kroku `Potvrzeni planu`
5. hrac klikne:
   - `Ulozit plan`
   - nebo `Zpet do konceptu`
6. teprve potom vznika serverovy plan

Pravidla:

- `blocked` validace neumozni ulozeni
- `warning` validace umozni ulozeni az po explicitnim potvrzeni
- `ok` validace take prechazi pres krok potvrzeni, ale bez blokace
- po uspesnem ulozeni ma lokalni draft ustoupit serverovemu planu

### Aktivni karta planu

Karta aktivniho planu ma ukazovat:

- cil
- stav planu
- pocet legu
- impact okno `od -> do`
- cas do prvniho odeslani
- dalsi nejblizsi akci

Stavova logika:

- pred prvnim odeslanim: ukazovat countdown `spusteni za X`
- pri `dispatching`: ukazovat progress `odeslano N / total`
- progress procento se pocita jen z poctu odeslanych legu
- po `completed`: plan uz neni aktivni, presune se do `completed_stub`

`completed` znamena:

- vsechny legy byly uspesne odeslany
- neresime vysledek boje

### Editace aktivniho planu

Editace je povolena jen pro:

- `scheduled`
- `needs_reconfirmation`

Editace neni povolena pro:

- `dispatching`
- `completed`
- `failed`
- `canceled`

Pokud lead time vyprsi behem editace:

- save failne
- hrac dostane jasny duvod
- UI se vrati na posledni serverovou verzi planu

### Needs reconfirmation

Pri `needs_reconfirmation` UI musi ukazat:

- co se zmenilo
- novy owner targetu
- nove kralovstvi targetu
- proc je plan rizikovy

Akce:

- `Potvrdit i tak`
- `Zpet do konceptu`

Pokud hrac zvoli `Zpet do konceptu`:

- koncept ma prevzit informace o poslednim selhani / duvodu reconfirmation
- tyto informace musi zustat na ocich i po navratu do editoru

## 2. UX doplnky pro pouzitelnost

### Automaticke srovnani casu

Planner ma umet dve varianty:

- `Srovnat od prvniho legu dopredu`
- `Srovnat od posledniho legu zpet`

Parametry:

- referencni leg
- referencni impact time
- rozestup mezi legy

Pouziti:

- rychle prepocteni cele casove osy po zmene poradi
- rychle dorovnani po manualnich upravach

### Vyplnit vse

Akce `Vyplnit vse` ma pro `v1` pouzit pouze:

- `jezdec`
- `beranidlo`
- `zved`

Pravidla:

- pouzije se maximum dostupnych poctu pro planovani
- jednotky mimo tuto mnozinu se touto akci nedoplnuji
- `zved` je zamerne soucasti akce jako pojistka pro ziskani informaci

Volitelne doplnky:

- per-unit `ALL`
- per-leg `Vyplnit vse`
- per-leg `Vymazat vse`

## 3. Ulozena data a jednoducha historie

Pro `v1` nechceme archiv planu.

Chceme jen:

- `active_plan`
- `last_completed_stub`

To znamena:

- po ulozeni noveho planu existuje jeden aktivni plan
- po jeho dokonceni se z nej stane posledni dokonceny stav
- pri dokonceni dalsiho planu se predchozi dokonceny stav prepise

Minimalni obsah `completed_stub`:

- id planu
- cil
- pocet legu
- cas prvniho odeslani
- cas posledniho odeslani
- dokonceno v

## 4. Budouci reporty pres `plan_id`

Toto neni soucast `v1`, ale ma se na to myslet uz pri navrhu dat.

Budouci cil:

- planned utoky budou mit v eventech / zaznamech `plan_id`
- FE + BE podle `plan_id` slozi souhrn planu
- nad tim pujde pozdeji postavit samostatna epicka stranka se souhrnem

Minimalni budoucne pozadavky na data:

- `plan_id`
- `plan_leg_id`
- `event_type`
- `origin_village_id`
- `target_village_id`
- `created_at`
- snapshot labely pro origin/target

Pozdeji pak pujde skladat:

- plan vs. realne odeslane rozkazy
- poradi legu
- reporty po boji
- jednotny souhrn planovane akce

## 5. Co je jeste potreba domyslet

### Serverovy cas je autoritativni

Planner musi vsude pocitat se serverovym casem.

To znamena:

- validate i create musi pocitat lead time server-side
- FE nesmi byt autorita pro finalni casovou validaci

### Kdy presne plan prejde do `dispatching`

Doporuceni:

- jakmile prvni leg vstoupi do dispatch okna
- od tohoto momentu uz plan neni editovatelny

### Jak se pocita progress

Doporuceni:

- progress jen podle `sent legs / total legs`
- ne podle casu
- ne podle impactu

### Co kdyz se zmeni dostupnost jednotek

Mozne duvody:

- mezitim byly jednotky poslany jinam
- cast armady se vratila pozdeji
- nektera jednotka uz neni dostupna v pozadovanem poctu

Doporuceni:

- finalni pre-flight kontrola pred dispatch
- pri failu ulozit duvod per leg
- hrace vratit zpet do konceptu s viditelnym duvodem

### Co kdyz se zmeni origin leno

Napriklad:

- zmena jmena
- ztrata lena
- zmena ownera

Doporuceni:

- plan nesmi spolehat jen na live nazvy
- snapshot labely drzet zvlast
- validace musi origin znovu overit

## 6. Doporucene implementacni poradi

1. uzavrit stavovy model `draft -> confirmation -> active_plan -> completed_stub`
2. doplnit backend `validate/create/update/cancel/reconfirm`
3. napojit potvrzovaci krok v UI
4. doplnit aktivni kartu planu
5. doplnit `Vyplnit vse`
6. doplnit automaticke srovnani casu dopredu i zpet
7. doplnit `last_completed_stub`
8. pripravit event schema tak, aby slo pozdeji pripojit `plan_id`

## 7. Feature contract pro dalsi implementaci

- Goal: dodelat planner tak, aby lokalni koncept vedl na autoritativni serverovy plan a mel jasne rezimy
- Authoritative state: serverovy plan a jeho legy; lokalni draft je jen pomocny editor
- Fetch model: planner ma vlastni read/write endpointy, bez noveho globalniho pollingu
- Affected panels: Armada / Planovac
- Regression risk: nechtene tick-on-read, nejasny prechod draft vs. active plan, chyby v lead time a dispatch logice
- Before metrics: pocet requestu pri otevrenem planneru, velikost planner payloadu, pocet rerenderu army panelu
- Expected impact: pouzitelny planner bez falesneho dojmu, ze `validni koncept` uz neco dela
