# Taktiktavle

En webapp til fodboldopstillinger og taktik, der kører på computer, tablet og telefon.
Den kan installeres som app på hjemmeskærmen (PWA) og virker uden net, når den først er hentet.

## Hvad den kan

- **Kampformat:** 11 mod 11, 8 mod 8 og 5 mod 5 med tilpasset banestørrelse og mål.
- **Formationer:** 9 til 11 mod 11, 5 til 8 mod 8 og 4 til 5 mod 5. Ved skift beholder spillerne navn og får den nærmeste plads i den nye formation.
- **Udgangspunkt:** Defensiv, Normal eller Offensiv for hver formation – for eget hold og modstanderen hver for sig. Defensiv ligger dybere, smallere og mere kompakt (kanterne trækker ned). Offensiv ligger højt og bredt (backs skubber op, kanterne højt, 10'eren foran 8'eren).
- **Positioner:** engelske forkortelser – GK, LB, CB, RB, LWB, RWB, DM, CM, CAM, LM, RM, LW, RW, SS og CF.
- **Klassiske numre:** 1 GK · 2 RB · 3 LB · 4/5 CB · 6 DM · 7 RW/RM · 8 CM · 9 CF · 10 SS/CAM · 11 LW/LM. Numrene følger positionen, når formationen skiftes. Skriver du selv et nummer (fx spillerens rigtige trøjenummer), beholder spilleren det.
- **Spillere:** træk dem rundt. Tryk på en spiller for at rette nummer, navn og rolle. Holdfarver og målmandsfarve kan vælges.
- **Egenskaber (1–10):** hver spiller – også udskiftere og modstanderen – har fart, teknik, afslutning, forsvar, fysik og målmand. 5 er gennemsnit. Åbn spillerkortet ved at trykke på spilleren eller på rollen i holdlisten; *Niveau for hele holdet* sætter alle egenskaber på én gang. Tavler fra før egenskaberne åbnes med 5 overalt.
- **Logoer:** læg eget og modstanderens logo som vandmærke i hver sin banehalvdel, med justerbar styrke. Kommer også med på det delte billede.
- **Udskiftere:** tilføj dem, og skift dem ind for en starter.
- **Modstander:** vis modstanderen med sin egen formation og farve.
- **Taktik:** vælg en klassisk taktik – Manchester City (Guardiola 2022/23, 3-2-4-1), FC Bayern (Nagelsmann 2021/22), Liverpool (Klopp 2019/20), FC Barcelona (Guardiola 2010/11), Arsenal (Arteta 2023/24), Chelsea (Conte 2016/17), Real Madrid (Ancelotti 2021/22), Inter (Mourinho 2009/10), Atlético (Simeone 2013/14), Leicester (Ranieri 2015/16) og Danmark (EM 1992) – eller indstil jeres egen: pres, forsvarslinje, tempo, bredde og afleveringer. Gælder eget hold og modstanderen hver for sig.
- **Dødbolde:** variant i angreb (nærmeste stolpe, bageste stolpe, kort, blandet) og opdækning i forsvar (zone, mand, blandet). Knappen *Stil op i et nyt trin* stiller begge hold op til hjørnespark eller frispark med løb og afleveringer tegnet ind.
- **Kampsimulering (som i Football Manager):** kampen spilles i 2D med afleveringer, driblinger, tacklinger, indlæg, lange bolde, skud, redninger, hjørnespark, frispark, indkast og målspark. Spillerne bevæger sig som et hold: angriberne søger ind i feltet, backen overlapper, forsvarerne dækker op på målsiden, og ingen står offside uden grund. Der er frispark med gule og røde kort (to gule giver rødt), straffespark, skader og kondition; et hold med en mand mindre ofrer den mest offensive plads. Modstanderens manager skifter ud omkring 60., 70. og 80. minut og ændrer taktik sent i kampen. Spilleur, kommentarlinje, momentum-graf og visning som *Højdepunkter* eller *Hele kampen* (1×–8×), med navne under spillerne efter ønske. Før kampen vises det forventede udfald. Pause med statistik ved halvleg. Under kampen kan du ændre udgangspunkt og instruktioner, råbe fra sidelinjen (fx “Pres højere”) og skifte spillere ind fra bænken (kondition vises). Statistikken har xG gennem kampen, skudkort og gennemsnitlige positioner, og hvert mål kan ses igen. Efter kampen: spillerkarakterer (1–10) og kampens spiller. Udfaldet afgøres af formation, udgangspunkt, instruktioner, dødboldtaktik og spillernes egenskaber (fx hurtige angribere mod langsomme forsvarere med høj linje, kant mod back, teknisk midtbane, afslutning og målmand); *Simulér 500 kampe* giver sandsynligheder for sejr, uafgjort og nederlag.
- **Feedback:** styrker og svagheder i taktikken, i opstillingen på banen (kompakthed, bredde, bagkæde på linje, huller, isolerede angribere, overtal/undertal i zoner) mod modstanderen og ud fra spillernes egenskaber (fart i forsvaret mod linjens højde, dueller på kanterne, midtbanens teknik, målmand, luftdueller, afsluttere). Tips beregnes ved at afprøve ændringer i 400 simulerede kampe; hvert tip har en *Anvend*-knap. Overtal og undertal kan også vises som farvede zoner direkte på tavlen.
- **Tegning:** løb, aflevering (stiplet), dribling (bølget), zone og fri streg i fem farver. Pile fra og til en spiller sættes automatisk ved spilleren.
- **Trin:** byg en sekvens i flere trin med en note til hvert. *Afspil* animerer bevægelserne, og forrige trin vises som skygge.
- **Fortryd/gentag:** Ctrl/Cmd+Z og Ctrl/Cmd+Shift+Z.
- **Del:** gem et billede (PNG) af det aktuelle trin, eller gem hele tavlen som fil/tekst og åbn den på en anden enhed.
- **Mine tavler:** alle tavler gemmes automatisk i browseren på enheden.

Tastatur: V flyt · L løb · A aflevering · D dribling · Z zone · S streg · ←/→ skift trin · Delete sletter valgt tegning.

## Filer

| Fil | Indhold |
| --- | --- |
| `app.html` | Hele appen (HTML, CSS og JavaScript). Kilden, der redigeres. |
| `build.py` | Laver `docs/index.html` og `docs/sw.js` ud fra `app.html`. |
| `docs/` | Den færdige webapp. GitHub Pages udgiver denne mappe. |
| `tools/make_icons.py` | Tegner app-ikonerne i `docs/icons/`. |
| `tools/sw.template.js` | Skabelon til service worker (offline-brug). |

## Kør den lokalt

```bash
python3 build.py
python3 -m http.server 8765 --directory docs
```

Åbn derefter http://localhost:8765 i browseren.

## Læg den på telefon og tablet

Appen ligger på **https://gammowich.github.io/taktiktavle/** (GitHub Pages udgiver `docs/` fra `main`).
Efter en ændring: ret `app.html`, kør `python3 build.py`, commit og push – så er den nye version ude efter et minut eller to.

- **iPhone/iPad (Safari):** åbn adressen → Del → *Føj til hjemmeskærm*.
- **Android (Chrome):** åbn adressen → menu → *Installer app*.
- **Computer (Chrome/Edge):** installer-ikonet i adresselinjen.

## Data

Tavlerne gemmes i browserens lager på den enkelte enhed. De synkroniseres ikke mellem enheder.
Brug *Del → Gem som fil* og *Mine tavler → Åbn fil* for at flytte en tavle til en anden enhed.
