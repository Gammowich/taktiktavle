# Taktiktavle

En webapp til fodboldopstillinger og taktik, der kører på computer, tablet og telefon.
Den kan installeres som app på hjemmeskærmen (PWA) og virker uden net, når den først er hentet.

## Sådan er den bygget op

Banen står i midten. Resten er delt i fire faner efter, hvad du er i gang med:

- **Hold:** formation, udgangspunkt, spillere (tryk for spillerkortet med nummer, navn, rolle og egenskaber), bænk og niveau for hele holdet.
- **Taktik:** klassisk taktik, instruktioner, dødboldtaktik og *Stil op i et nyt trin*.
- **Tegn:** tegneværktøjer, stregfarve, trin med noter og *Afspil*. Kun her tegner man; i de andre faner flytter banen kun spillere.
- **Kamp:** forventet udfald, *Spil kampen*, assistenten, 500 simulerede kampe og feedback med styrker og svagheder.

Øverst i Hold og Taktik skifter *Mit hold | Modstander* mellem holdene, og øjet viser eller skjuler modstanderen på banen. Tryk på tavlens navn for **tavlemenuen**: navn, mine tavler (ny, åbn fil, indsæt tekst, kopi, slet) og udseende (kampformat, holdfarver, logoer og navne/roller på banen). På telefonen på højkant ligger fanerne nederst, og panelet kan gøres større med håndtaget. På tværs står banen til venstre og fanerne og panelet til højre, ligesom på computer og tablet.

## Hvad den kan

- **Kampformat:** 11 mod 11, 8 mod 8 og 5 mod 5 med tilpasset banestørrelse og mål.
- **Formationer:** 9 til 11 mod 11, 5 til 8 mod 8 og 4 til 5 mod 5. Ved skift beholder spillerne navn og får den nærmeste plads i den nye formation.
- **Udgangspunkt:** Defensiv, Normal eller Offensiv for hver formation – for eget hold og modstanderen hver for sig. Defensiv ligger dybere, smallere og mere kompakt (kanterne trækker ned). Offensiv ligger højt og bredt (backs skubber op, kanterne højt, 10'eren foran 8'eren).
- **Positioner:** engelske forkortelser – GK, LB, CB, RB, LWB, RWB, DM, CM, CAM, LM, RM, LW, RW, SS og CF.
- **Klassiske numre:** 1 GK · 2 RB · 3 LB · 4/5 CB · 6 DM · 7 RW/RM · 8 CM · 9 CF · 10 SS/CAM · 11 LW/LM. Numrene følger positionen, når formationen skiftes. Skriver du selv et nummer (fx spillerens rigtige trøjenummer), beholder spilleren det.
- **Spillere:** træk dem rundt. Tryk på en spiller (på banen eller i listen under Hold) for at rette nummer, navn, rolle og egenskaber. Holdfarver og målmandsfarve vælges i tavlemenuen.
- **Egenskaber (1–10):** hver spiller – også udskiftere og modstanderen – har fart, teknik, afslutning, forsvar, fysik og målmand. 5 er gennemsnit. Åbn spillerkortet ved at trykke på spilleren på banen eller i listen under Hold; *Sæt niveau for hele holdet* sætter alle egenskaber på én gang. Tavler fra før egenskaberne åbnes med 5 overalt.
- **Logoer:** læg eget og modstanderens logo som vandmærke i hver sin banehalvdel, med justerbar styrke. Kommer også med på det delte billede.
- **Udskiftere:** tilføj dem under Hold, og skift dem ind fra spillerkortet (fra starterens eller udskifterens kort).
- **Modstander:** vis modstanderen med sin egen formation og farve.
- **Taktik:** vælg en klassisk taktik – Manchester City (Guardiola 2022/23, 3-2-4-1), FC Bayern (Nagelsmann 2021/22), Liverpool (Klopp 2019/20), FC Barcelona (Guardiola 2010/11), Arsenal (Arteta 2023/24), Chelsea (Conte 2016/17), Real Madrid (Ancelotti 2021/22), Inter (Mourinho 2009/10), Atlético (Simeone 2013/14), Leicester (Ranieri 2015/16) og Danmark (EM 1992) – eller indstil jeres egen: pres, forsvarslinje, tempo, bredde og afleveringer. Gælder eget hold og modstanderen hver for sig.
- **Dødbolde:** variant i angreb (nærmeste stolpe, bageste stolpe, kort, blandet) og opdækning i forsvar (zone, mand, blandet). Knappen *Stil op i et nyt trin* stiller begge hold op til hjørnespark eller frispark med løb og afleveringer tegnet ind.
- **Kampsimulering (som i Football Manager):** kampen spilles i 2D med afleveringer, driblinger, tacklinger, indlæg, lange bolde, skud, redninger, hjørnespark, frispark, indkast og målspark. Spillerne bevæger sig som et hold: angriberne søger ind i feltet, backen overlapper, forsvarerne dækker op på målsiden, og ingen står offside uden grund. Der er frispark med gule og røde kort (to gule giver rødt), straffespark, skader og kondition; et hold med en mand mindre ofrer den mest offensive plads. Modstanderens manager skifter ud omkring 60., 70. og 80. minut og ændrer taktik sent i kampen. Slå *Assistenten styrer mit hold* til under Taktik, så klarer assistenten det samme for jeres hold: den skifter trætte spillere og forsvarere med gult kort ud fra bænken (den udskifter, hvis egenskaber passer bedst til pladsen) og går efter udligningen eller lukker ned sent i kampen. Du kan stadig selv gribe ind, og indstillingen huskes. Spilleur, kommentarlinje, momentum-graf og visning som *Højdepunkter* eller *Hele kampen* (1×–8×), med navne under spillerne efter ønske. Før kampen vises det forventede udfald. Pause med statistik ved halvleg. Under kampen kan du ændre udgangspunkt og instruktioner, råbe fra sidelinjen (fx “Pres højere”) og skifte spillere ind fra bænken (kondition vises). Statistikken har xG gennem kampen, skudkort og gennemsnitlige positioner, og hvert mål kan ses igen. Efter kampen: spillerkarakterer (1–10) og kampens spiller. Udfaldet afgøres af formation, udgangspunkt, instruktioner, dødboldtaktik og spillernes egenskaber (fx hurtige angribere mod langsomme forsvarere med høj linje, kant mod back, teknisk midtbane, afslutning og målmand); *Simulér 500 kampe* giver sandsynligheder for sejr, uafgjort og nederlag.
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
| `tools/konto_test.mjs` | Test af MG Games-kontoen: to "enheder" i headless Chrome mod MG Games-serveren kørt lokalt. |
| `tools/sw.template.js` | Skabelon til service worker (offline-brug). |
| `mac/` | Mac-programmet til MG Games-launcheren: appen i sit eget vindue (Swift, WKWebView). `mac/build.sh` bygger det. |
| `windows/` | Windows-programmet til launcheren (Godot 4.7): appen i sit eget vindue via Edge eller Chrome. `windows/build.sh` bygger det. |
| `launcher/Taktiktavle.html` | Den første startside i launcheren (build 1). Den åbnede appen i browseren. Bruges ikke længere. |
| `launcher/omslag.html` | Kilden til omslaget i launcheren (1920 × 700). |
| `launcher/GRAFIK_LAUNCHER.md` | Hvad nye billeder til launcheren skal opfylde (omslag og ikon). |
| `launcher/omslag_zoner.png` | Skabelon i 1920 × 700, der viser, hvilke dele af omslaget launcheren viser. |

## I MG Games-launcheren

I MG Games-launcheren åbner Taktiktavle i sit eget vindue, ligesom Viking Legacy og SWAAG. Begge programmer henter appen
fra https://gammowich.github.io/taktiktavle/. Derfor er appen altid i nyeste udgave. Programmerne skal kun bygges og
udgives igen, når de selv ændres.

- **Mac:** `mac/Taktiktavle.swift` er et lille program med et indbygget browservindue (WKWebView). Det fylder ca. 800 KB
  og er bygget til Apple silicon og Intel med macOS 12 eller nyere. Det er kun afprøvet på macOS 26.
  - Del → Gem bruger Macens gem-vindue, og Åbn fil bruger Macens filvalg.
  - ⌘Z går til appens fortryd.
  - Programmet sender `pagehide`, når det lukker, så appen når at gemme.
  - Andre links åbner i standardbrowseren.
  - Uden net åbner den udgave, der blev hentet sidst. Er der intet hentet, viser programmet en side, der forklarer det.
- **Windows (ikke afprøvet på en Windows-pc):** `windows/main.gd` er et Godot-program uden eget vindue. Det åbner appen i Edge, som følger med Windows, i
  app-tilstand: eget vindue uden faner og adresselinje.
  - Edge bruger sin egen profil i `%LOCALAPPDATA%\Taktiktavle\browser`.
  - Programmet venter, til vinduet lukkes, så launcheren viser "Kører".
  - Uden Edge bruges Chrome. Er der ingen af dem, eller lukker browseren med det samme, åbnes appen i standardbrowseren.
- **iPad, iPhone og Android:** her findes launcheren ikke. Appen lægges på hjemmeskærmen fra browseren (se nedenfor).

**Tavlerne** gemmes i hvert program for sig, adskilt fra browseren. Med login på MG Games-kontoen følger de med
mellem dem (se "MG Games-kontoen" herunder); ellers flyttes en tavle med Del → Gem som fil og Tavlen → Åbn fil.

Byg og afprøv Mac-programmet:

```bash
mac/build.sh
```

```bash
mac/build/Taktiktavle.app/Contents/MacOS/Taktiktavle --smoke
```

Røgtesten (`--smoke`) prøver disse ting af:

- at appen bliver indlæst,
- lageret, og at en ændring lige før lukning bliver gemt,
- ⌘Z,
- Gem billede og Gem som fil,
- Kopiér billede (udklipsholderen lægges tilbage),
- Åbn fil.

Den bruger sit eget lager, så de rigtige tavler ikke bliver rørt. Med `--headless` kører den uden vindue og springer
⌘Z, udklipsholderen og Åbn fil over, fordi de kræver rigtige klik. `TAKTIKTAVLE_URL` peger den mod en anden adresse,
fx en lokal server med `docs/`.

Byg Windows-programmet:

```bash
windows/build.sh
```

Det kan ikke køres på Macen. Logikken kan dog afprøves på Macen med Chrome: `Godot --path windows -- --smoke` og
`TAKTIKTAVLE_DRY=1 Godot --path windows`.

Omslag og ikon ligger i `~/Claude/MGGamesLauncher/games/taktiktavle/`. Ikonet er `docs/icons/icon-512.png` skaleret til
256 × 256. Omslaget laves sådan:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --window-size=1920,700 \
  --virtual-time-budget=8000 --screenshot=omslag.png "file://$PWD/launcher/omslag.html"
```

Gem det derefter som jpg i 1920 × 700. Udgivelsen følger `docs/NYT_SPIL.md` i launcher-repoet.

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

Tavlerne gemmes altid i lageret på den enkelte enhed, også uden login og uden net. En tavle kan flyttes med *Del → Gem
som fil* og *Tavlen → Åbn fil*.

### MG Games-kontoen

Under *Tavlen → MG Games-konto* kan man logge ind eller oprette en konto. Så gemmes tavlerne også på kontoen og følger
med på alle enheder: Mac, Windows, iPad og telefon. Morten 4/10: *"gem lokalt uden login, nyeste vinder"*.

- **Hver tavle sin plads.** Hver tavle har sin egen plads under spillet `taktiktavle` på MG Games-serveren, og pladsen
  hedder det samme som tavlens id.
- **Den nyeste vinder.** Er en tavle ændret flere steder, vinder den udgave, der er ændret senest (tavlens `updated`).
- **Sletninger.** De huskes i pladsen `-slettede`, så de når de andre enheder. Er tavlen ændret dér efter sletningen,
  kommer den tilbage. Kun sletninger fjerner tavler. Forsvinder en tavle fra kontoen på anden vis, lægger enheder, der
  stadig har den, den op igen.
- **Eksempeltavlen.** Den urørte eksempeltavle bliver på enheden. Hver enhed laver sin egen.
- **Hvornår der synkroniseres.** Ved login og start, 4 s efter en ændring, når appen skjules eller lukkes, hvert andet
  minut, mens den er åben, og med *Synkronisér nu*. Mac-programmet venter ved lukning på synkroniseringen, højst 4 s.
- **Uden net.** Appen siger det og lægger tavlerne op senere.
- **Mac via launcheren.** Programmet bruger launcherens login (`session.json`), så man kun logger ind ét sted. Log ud i
  appen forlader kun login'et i appen.
- **Slet mine tavler på kontoen.** Fjerner alle pladserne og logger ud. Tavlerne bliver på enheden. Andre enheder, der
  stadig er logget ind, lægger deres tavler op igen.
- **Claude-udgaven.** Kontoen vises ikke dér, for siden kan ikke kalde MG Games.

Serveren svarer kun websider fra `https://gammowich.github.io` og lokale tests (CORS, se `server/src/index.js` i
MGGamesLauncher).

Test:

```bash
python3 build.py
```

```bash
node tools/konto_test.mjs
```

Testen bruger to "enheder", appen på `127.0.0.1` og på `localhost`. Den prøver af:

- at tavler gemmes uden login,
- oprettelse af konto og login,
- at tavler hentes til den anden enhed,
- at den nyeste vinder, begge veje,
- uden net,
- sletning, og at en ændring efter en sletning bringer tavlen tilbage,
- at der ikke er kald til serveren i tomgang,
- udløbet login, log ud og forkert adgangskode,
- "Slet mine tavler på kontoen".

Testen bruger `?mgapi=http://127.0.0.1:<port>/v1`. Den adresse godtager appen kun for localhost og 127.0.0.1.
