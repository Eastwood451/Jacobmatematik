# Dækning efter anden omgang (8. november 2026)

Ikke færdigt. Ikke udgivet. Dansk er kilden. Engelsk er laget i `i18n-en.js`.

## Matrix

| Modul | Implementeret | Testet | Mangler |
| --- | --- | --- | --- |
| Sprogvalg, `/en/`, reload | Ja | Enhedstest + browser | — |
| Login, gæst, forkert login, cookie | Ja | Browser EN og DA | Malet tekst i login-billedet |
| Plus-drill | Ja | Browser EN forkert/rigtigt, DA forkert, mobil | — |
| PEMDAS | Ja | Browser EN forkert svar, DA bliver dansk | — |
| Gange-drill og lille tabel | Ja | Browser EN, 0 danske rester i scanneren | — |
| Brøk-lektion (forkert regneart) | Ja | Browser EN, 0 rester | Senere trin (vend, forkort, plus/minus) er i ordbogen, ikke klikket igennem |
| 10’er-venner | Ja | Browser EN intro, hint og forkert makker, 0 rester | — |
| Foodtruck | Ja | Browser EN hint og forkert svar, 0 rester. Gæster ser ikke kortet; testen monterede modulet uden at ændre gæste-gaten | — |
| FPS-kort på login | Ja, kun kortets tekst | Browser: 0 danske rester i kortets tekst | Spillet og stemmerne er ikke oversat |
| Lærerportal | Faste sætninger og anbefalinger i ordbogen | Ikke i browseren. Der er ikke et lærerkonto-login i testen | Dynamiske sætninger med elevnavn kan stadig have et hul, hvis de ikke matcher et mønster |
| Skak, vinkler, vinkelspil, brøk-løb | Baseline-tekst i ordbogen | Ikke i browseren. Gaten for Jacobs profiler er uændret, så gæst kan ikke åbne dem | Nye sætninger, som PR #65 og #67 indfører, når de merges |
| Plus-penalhus og ur | Nej, med vilje | Browser: stadig danske | Codex-handoff |
| Marley-butik, PR #34 | Nej | Ikke åbnet | Parkeret |
| Bogstav-ord og lyd | Instruktion kan være engelsk. Ordene er danske | Ikke kørt | Ikke engelsk paritet. Lyden siger det danske ord |
| Øbbe-tilråb | Tekst oversat | Ikke kørt | MP3 er danske |
| Erling FPS | Nej | Ikke kørt | Stemmer, “slapper”, bane |

## Indbrændt billede

Der findes kun `assets/figurer/jacobmatematik-cinematic-world-v1.webp`. Ingen engelsk tvilling. Alt-teksten oversættes. Pixlerne (titlen, skiltene, “SKOLE”) kan ikke oversættes uden et nyt billede. Et CSS-lag ovenpå ville dække maleriet. Billedet står derfor uændret.

## Lyd, ærligt

- Luigis generator er stadig `it-IT-DiegoNeural`. Den fil er ikke ændret.
- `Jeg slapper din matematik-eksamen!` er uændret.
- Bogstaverne `abe`, `bæver`, `løve`, `næsehorn`, `ræv`, `sæl`, `æsel`, `økse`, `ål` og de andre danske ord er ikke oversat, fordi lydfilen siger det ord.
- Øbbes og Erlings MP3-filer er danske. Engelsk tekst på skærmen er ikke den samme oplevelse som engelsk tale.

## Åbne PR’er, konkrete

Ordbogen rører ikke `skak.js`, `angles.js`, `angle-dennis.js`, `app.js` eller `brok-loeb.js`. Derfor er der ingen git-konflikt med PR #64 i skak-filerne, og baseline-teksten kan oversættes alligevel.

- PR #64 ændrer animation i skak. Ingen af de oversatte sætninger står som slettet tekst. Ingen blokering for den nuværende baseline.
- PR #65 sletter Dennis-instruktionen “Giv ordrer: drej og gå – så finder Dennis fisken.” og sandbox-linjen om at dreje og gå. Den nye tekst er “Vælg vinkel, tryk Gå – hjælp Dennis til pizzaen.” Når #65 merges, er den nye sætning ikke i ordbogen, før nogen tilføjer den. PR #65 ændrer også `app.js`. Denne gren ændrer ikke `app.js`, så der er ingen konflikt i den fil.
- PR #67 fjerner “Luk cirklen: bøj, så den passer i rillen.” fra ét sted og beholder “Bøj piberenseren”. Efter merge mangler den fjernede sætning bare, den blokerer ikke baseline.
- PR #69 ændrer `index.html` (samme fil som sprog-scriptet) og `app.js`. Den konkrete git-konflikt er script-linjerne i `index.html`, hvis begge grene merges. Den blokerer ikke oversættelsen af den nuværende tekst.

## Test i denne omgang

- `node scripts/test-i18n.cjs`
- `node scripts/shot-i18n.cjs` (EN/DA plus, reload, login-fejl, penalhus, ur)
- `node scripts/shot-i18n-coverage.cjs` (brøk, 10’er-venner, foodtruck, PEMDAS, gange-drill, lille tabel, FPS-kort, dansk PEMDAS)

## Hvad der stadig er tilbage

Ubeskyttet, mindre end denne omgang: en lærerkonto i browseren, de brøk-trin der ikke blev klikket, og de sætninger PR #65 tilføjer når den merges. Plus ét nyt login-billede, hvis den malede tekst skal væk.

Beskyttet, separat: hele ur-kurset i `clock.js`, `clock-core.js` og `clock-course.js`, plus hele `plus-penalhus.js` og deres danske lyd. Listen står i `docs/i18n-protected-handoff.md`. Det kan ikke gøres på denne gren.
