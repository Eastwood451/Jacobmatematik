# Dækning (8. november 2026, tredje omgang)

Ikke udgivet. Dansk er kilden. Et tal på “0 danske rester” gælder kun den flade, testen navngiver. Det betyder ikke, at hele modulet er kørt igennem.

Fixture-tests er **ikke** rigtige logins. Supabase er stubbet. Brugerne findes kun i testbrowserens `localStorage`. Profil-id’erne er de id’er, gates allerede tillader. Gates i `app.js` er ikke ændret, og der skrives ikke til den rigtige database.

## Testede flader

| Flade | Sprog | Resultat | Bevis |
| --- | --- | --- | --- |
| Brøk, division: forkert regneart | EN, gæst | 0 rester | `shot-i18n-fixtures.cjs` |
| Brøk, division: forkert regel | EN, gæst | 0 rester | samme |
| Brøk, division: forkert vending af brøken | EN, gæst | 0 rester | samme |
| Brøk, division: forkert gangeregel | EN, gæst | 0 rester | samme |
| Brøk, division: forkert produkt, derefter 4/6 | EN, gæst | 0 rester | samme |
| Brøk, division: forkort-trinnet og et forkert “den er fin” | EN, gæst | 0 rester | `en-fraction-simplify.png` |
| Plus, minus og gange som brøk-tilstand | — | Ikke klikket | Samme motor og mange fælles sætninger, men ikke denne kørsel |
| Lærerportal, forsiden med én fixture-elev | EN, lokal fixture | 0 rester | `en-teacher-fixture.png`. Ikke en rigtig lærerkonto |
| Skak-menu | EN, fixture-lærer | 0 rester | `en-skak-fixture.png` |
| Skak, ét forkert svar mod computeren | EN, fixture | 0 rester | `en-skak-wrong-fixture.png`. Ikke et helt parti, ikke online |
| Vinkel-hub og lektionens første skærm | EN, fixture | 0 rester | `en-angles-hub-fixture.png`, `en-angles-lesson-fixture.png`. De fem spil er ikke spillet |
| Brøk-løb, startkort | EN, fixture-elev med gate-id | 0 rester | `en-runner-fixture.png`. Ingen bane og intet brøkspørgsmål |
| Fixture-elev, reload | EN | `jm-lang` bliver `en` | ikke et rigtigt login |
| Fixture-elev, hjem efter `jm-lang=da` | DA | ingen engelsk “What do you want to practise” | `da-fixture-home.png` |
| Plus-drill, PEMDAS, 10’er-venner, foodtruck, gange-drill | EN/DA som i forrige omgang | se `shot-i18n.cjs` og `shot-i18n-coverage.cjs` | gæst, ikke fixture |
| Plus-penalhus og ur | EN-app | bliver danske | produktiongates urørt |

## Ordbog uden kørsel

PR #65’s kommende sætning “Vælg vinkel, tryk Gå – hjælp Dennis til pizzaen.” ligger i ordbogen nu. PR #65 er ikke merget.

## Lyd og ord, ikke færdig engelsk

Kan oversættes på skærmen uden at lyden lyver: instruktioner, knapper, fejl og resultater, når der ikke afspilles en dansk optagelse af netop den sætning.

Kan ikke kaldes engelsk paritet:

- Bogstavøvelsens ord (`abe`, `bæver`, `løve`, `næsehorn`, `ræv`, `sæl`, `æsel`, `økse`, `ål` og resten). Lydfilen siger det danske ord. De er undtaget i fixture-scanneren.
- Øbbes MP3-tilråb. Boblen kan være engelsk. Lyden er dansk.
- Erling FPS, inklusive den bevidste “Jeg slapper din matematik-eksamen!”.
- Luigis talestrimmel. Generatoren er stadig `it-IT-DiegoNeural` og er ikke ændret.
- Ur og Plus-penalhus, inklusive deres danske lyd. Se `docs/i18n-protected-handoff.md`.

## Billede

`assets/figurer/jacobmatematik-cinematic-world-v1.webp` er det eneste login-maleri. Alt-teksten oversættes. Den malede titel, skiltene og “SKOLE” gør ikke. Der genereres ikke et nyt billede.

## Rest, groft

Ubeskyttet rest, hvis de uklikkede flader ligner dem, vi lige lukkede: brøk plus/minus/gange, ét brøkspørgsmål i løbet, de fem vinkelspil i spil, et skak-køb og lærerportalens dialoger (slet klasse, opret elev). Det er omkring **4–8 timers** videre test og ordbogsrettelser. Usikkerheden er, om de flader har mange nye sætninger. Det er ikke et løfte om en dato.

Beskyttet rest, først når begrænsningen løftes: ur-kurset i tre filer og Plus-penalhus, plus nye lydoptagelser. Ud fra handoff-listen er det omkring **8–16 timers** ejerarbejde, adskilt fra ordbogen. Denne gren kan ikke gøre det.
