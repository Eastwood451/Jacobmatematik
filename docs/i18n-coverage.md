# Dækning og sprogstatus (`cursor/english-exercise-flow-7151`)

## 1. Arkitektur og ét samlet semantisk sprogobjekt

Appen har én fælles HTML-indgang (`index.html`). Alle oversatte statiske tekster og `{var}`-skabeloner ligger nu samlet i **ét overskueligt JavaScript-objekt**, `window.JacobI18nStrings` i `i18n-strings.js`, med semantiske nøgler og begge sprogs egne tekster side om side (`{ da: "...", en: "..." }`):

- **1.374 semantiske nøgler** i `window.JacobI18nStrings` (`i18n-strings.js`).
- **0 legacy-fraser** i `window.JacobI18nPhrases` (`i18n-en.js` indeholder nu kun hjælpe-regex i `window.JacobI18nPatterns` til dynamisk tal-/ental-/flertalsbøjning). `JacobI18n.coverage().legacyIsNotSemantic` er `false`.
- **Automatisk `{var}`-skabelonmatch og indeks** i `i18n.js`: `ensureIndexes()` bygger tovejs opslag (`da -> key`, `en -> key`) samt kompilerede `{var}`-skabeloner fra `window.JacobI18nStrings` (inkl. oversættelse af indlejrede ord som `enerne`/`tierne`, `første`/`anden`, `spids`/`ret`/`stump`/`lige`).
- **Ingen tredjeparts-oversættelseswidgets** (ingen Google Translate, Weglot el.lign.).
- **`/en/`-infosidernes SEO og indgange bevaret**: Alle statiske `/en/*/index.html`-sider og deres links (`/?lang=en` og `/?lang=en&start=...`) samt `sitemap.xml` er uændrede.

## 2. Ét-klik sprogskift (`DA | EN`) uden genindlæsning eller nulstilling

Klik på `DA | EN` kalder `JacobLang.set(lang)` i `lang.js`, opdaterer `document.documentElement.lang` og `localStorage["jm-lang"]`, og udsender `jm-langchange`:

- `JacobI18n.refresh()` i `i18n.js` opdaterer alle `data-i18n-key`-, `data-i18n-aria-label`-, `data-i18n-title`-, `data-i18n-placeholder`- og `data-i18n-alt`-attributter (med fuld understøttelse af `data-i18n-arg-*` på både tekst og attributter) samt aktive tekstnoder og åbne popups/overlays uden at genindlæse siden eller kalde modulernes `mount()`.
- **Bevarer tilstand ved sprogskift midt i en øvelse**:
  - Igangværende spørgsmål, opgavetekst og opgavenummer nulstilles ikke.
  - Indtastet svar i `input#answer` bevares (og specialværdien `"Kan ikke beregnes"` $\leftrightarrow$ `"Cannot be calculated"` oversættes live i inputfeltet og accepteres på begge sprog i `app.js`).
  - Point, streak, aktive timere og login-session røres ikke.
  - **Brøk-løb (`brok-loeb.js`)**: Spørgsmål, svarmuligheder og regler oversættes via semantiske nøgler *før* `fracHtml()` splitter brøker i `<span>`-elementer. Canvas-sprites (`DUK!` $\leftrightarrow$ `DUCK!`, `SKOLE` $\leftrightarrow$ `SCHOOL`), port-bobler og åbne spørgsmåls-/feedback-overlays opdateres live ved `jm-langchange` uden at nulstille løbet eller distancen.
  - **Vinkler (`angles.js`) og Vinkel-Ninja (`angle-ninja.js`)**: Canvas-tekster (`Rille: {deg}°` $\leftrightarrow$ `Groove: {deg}°`, `Piberenser → rille` $\leftrightarrow$ `Pipe cleaner → groove`, Dennis' SVG-markør samt `PERFEKT`/`GODT`/`FORBI` i Vinkel-Ninja) genskrives ved `jm-langchange` uden at nulstille runde eller bræt.

## 3. Status opdelt på: Oversat, Kodet, Testet og Live

| Kategori | Status | Detaljer |
| --- | --- | --- |
| **Oversat** | **Færdig (1.374 semantiske nøgler)** | Alle UI-tekster, øvelsesinstruktioner, hints, svarfeedback, fejlbeskeder og resultater i ikke-fredede moduler ligger som `{ da, en }`-par i `i18n-strings.js` (`0` uoversatte UI-strenge ved fuld kilde-audit). |
| **Kodet** | **Færdig på PR-gren** | `i18n-strings.js`, `i18n-en.js`, `i18n.js`, `app.js`, `brok-loeb.js`, `angles.js`, `angle-ninja.js` og `install-app.js` er kodet og forbundet til live `jm-langchange`. |
| **Testet** | **Verificeret med Node- og kilde-tests** | `node scripts/test-i18n.cjs` (1.374 semantiske nøgler, tovejs DA$\leftrightarrow$EN, `{var}`-skabeloner, `legacyPhrases === 0`, uændrede hashes for alle 6 fredede filer, Luigi, Erling og adgangsgates) og `node scripts/test-lazy-load-startup.cjs` er bestået. Browser-baserede fixture-scripts (`scripts/test-i18n-switch.cjs`, `scripts/shot-i18n-rest.cjs`) er opdateret (inkl. fix af kapløb på slagskibs-frys), men afventer kørsel i et miljø uden lokal browser-sandbox-blokering. |
| **Live** | **Ikke live (afventer Jacobs Go)** | Ændringerne ligger kun på grenen `cursor/english-exercise-flow-7151` (PR #71). Ingen merge til `main` og ingen udgivelse til produktion er foretaget. |

## 4. Fredede moduler og bevidste undtagelser (uændrede efter instruks)

Følgende filer og funktioner er verificeret **100 % urørte** (bekræftet automatisk i `scripts/test-i18n.cjs`):

- **Fredede moduler**: `plus-penalhus.js`, `clock.js`, `clock-core.js`, `clock-course.js`, `marley.js`, `marley-pet.js`. DOM-oversætteren i `i18n.js` springer `.pp-game`, `.cl-module` og `.marley-page` over, og deres manglende engelske dækning er dokumenteret særskilt i `docs/i18n-protected-handoff.md`.
- **Luigis stemme**: `scripts/generate_luigi_audio.py` bruger fortsat `it-IT-DiegoNeural`.
- **Erlings bevidste 'slapper'**: `"Jeg slapper din matematik-eksamen!"` i `fps-voice-lines.json` og `scripts/generate_erling_slapper_audio.py` er uændret.
- **Adgangsgates**: Alle adgangsgates i `app.js` (`CAN_PLAY_RUNNER_IDS`, `CAN_PLAY_ANGLES_IDS`, `CAN_PLAY_CLOCK_IDS`, `CAN_PLAY_PENALHUS_IDS`, `CAN_PLAY_MARLEY_IDS`) er uændrede.

## 5. Reelle mediehuller (registreret som faktiske huller — kaldes ikke færdig engelsk)

1. **Dansk tale/lyd (MP3/WAV)** — skærmtekster er engelske, men selve lydfilerne taler dansk:
   - **Bogstavøvelsens lydord** (`abe`, `bæver`, `løve`, `næsehorn`, `ræv`, `sæl`, `æsel`, `økse`, `ål` m.fl. i `LETTER_ITEMS` i `app.js`): Udtale-lydfilerne siger det danske ord, så bogstavordene er bevidst bevaret som danske lydord.
   - **Øbbes MP3-stemmer** (`assets/audio/oebbe/`): Talebobler på skærmen oversættes til engelsk, men MP3-lydklippene er på dansk.
   - **Erling FPS-stemmelinjer** (`fps-voice-lines.json` / MP3-filer): Dansk tale inkl. den bevidste *"Jeg slapper din matematik-eksamen!"*.
   - **Vinkel-intro og opgavelyd** (`assets/audio/angles/`): Tekst/undertekst på skærmen er engelsk, men indtalte MP3-filer er danske.
   - **Klokken og Plus-penalhus** (`assets/audio/clock/`, `assets/audio/penalhus/`): Fredede moduler med dansk lyd (se `docs/i18n-protected-handoff.md`).
2. **Tekst indbagt i grafik**:
   - `assets/figurer/jacobmatematik-cinematic-world-v1.webp`: Alt-tekst oversættes, men malede skilte i selve billedet (`SKOLE` m.v.) er indbagt i grafikken.
