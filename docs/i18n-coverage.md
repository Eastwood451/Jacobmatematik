# Dækning (8. november 2026)

## Semantiske nøgler, testet midtpunkt

Appen har én HTML-indgang, `index.html`. Begge sprog ligger i ét objekt, `JacobI18nStrings` i `i18n-strings.js`, med formen `nøgle.da` / `nøgle.en`. Skiftet er `JacobLang.set` i `lang.js`. Klik på DA|EN kalder det og sender `jm-langchange`. `JacobI18n.refresh` i `i18n.js` skriver kun teksten om. Det kalder ikke modulernes `mount` og skifter ikke side.

Nøglerne der faktisk er bundet med `data-i18n-key` eller `data-i18n-*` er: `home_prompt`, `exercise_back`, `exercise_hint_type_below`, `exercise_question_n`, `exercise_feedback_correct_is`, `exercise_feedback_tap_next`, `exercise_answer_label`, `exercise_answer_placeholder`, `exercise_keypad`, `exercise_round_label`, `angles_battleship_tap`, `angles_dennis_marker`, `runner_canvas_school`. `angles_battleship_frozen` og `angles_battleship_hit` ligger i objektet og bruges, når den danske sætning matcher nøjagtigt. De er ikke sat på hvert dynamisk skak- eller vinkelelement.

`i18n-en.js` er den gamle opslagsliste fra danske kildesætninger. Den er ikke semantiske nøgler. `JacobI18n.coverage()` siger det med `legacyIsNotSemantic`. Et nøjagtigt dansk match mod objektet hentes derfra, så de flyttede sætninger ikke findes to steder.

`scripts/test-i18n-switch.cjs` har kørt dette: hjemmeskiftet begge veje uden ny navigation, et åbent plusstykke beholder udtryk, tallet 7, opgavenummer og derefter det viste rigtige svar, når feedback skifter sprog begge veje. Placeholder og tastatur-etiket følger med. Brøk-løbets canvas-ord skifter mellem SKOLE og SCHOOL, mens løbet bliver i `run` og distancen ikke nulstilles. Dennis’ SVG-tekst læses fra objektet, og brættet bliver stående. Det er fixture, ikke en rigtig konto.

## Ikke med i «alle tekster»

Urørt kilde: `plus-penalhus.js`, `clock.js`, `clock-core.js`, `clock-course.js`, `marley.js`, `marley-pet.js`. Overlayet springer `.pp-game`, `.cl-module` og `.marley-page` over, så de bliver danske i den engelske app.

Stadig uden for nøglerne: bogstavordenes danske lyd, Øbbes MP3, Erlings linje «Jeg slapper din matematik-eksamen!», Luigis `it-IT-DiegoNeural`, login-billedets malede tekst, og de øvrige canvastegninger. `/en/` er statiske SEO-sider med egne links ind i appen via `/?lang=en`. De er ikke en anden app og ikke slettet.

## Tidligere flader

Ikke udgivet. Dansk er kilden. Et tal på “0 danske rester” gælder kun den flade, testen navngiver. Det betyder ikke, at hele modulet er kørt igennem.

Fixture-tests er **ikke** rigtige logins. Supabase er stubbet. Brugerne findes kun i testbrowserens `localStorage`. Profil-id’erne er de id’er, gates allerede tillader. Gates i `app.js` er ikke ændret, og der skrives ikke til den rigtige database.

## Testede flader

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

Ubeskyttet rest efter nøglemidtpunktet: de fleste sætninger ligger stadig i den gamle opslagsliste, og `scripts/shot-i18n-rest.cjs` er ikke grøn (slagskibets rigtige tryk blev afbrudt af computerens timer). Brøk plus/minus/gange til resultat, løbets spørgsmål, de fem vinkelspil og skak med simuleret makker er derfor ikke færdige semantiske nøgler. At flytte de viste sætninger over i objektet og køre de flows færdige er omkring **4–6 timers** videre arbejde. Usikkerheden er nye sætninger i de flows. Det er ikke en dato.

Beskyttet rest, først når begrænsningen løftes: ur-kurset i tre filer og Plus-penalhus, plus nye lydoptagelser. Ud fra handoff-listen er det omkring **8–16 timers** ejerarbejde, adskilt fra ordbogen. Denne gren kan ikke gøre det.
