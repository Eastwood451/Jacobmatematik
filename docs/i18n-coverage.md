# Checkpoint: engelsk øvelsesflow (8. november 2026)

Ikke færdigt. Ikke udgivet. Dansk er stadig kilden. Engelsk er et lag i `i18n-en.js`, som kun bruges når `jm-lang` er `en`.

`/en/` og `/?lang=en` sætter engelsk og bliver ikke overskrevet af browserens sprog. Et gemt `da` bliver ikke skubbet til engelsk. DA/EN i appen gemmer valget og overlever reload.

Arbejdet lå ikke på `main`, da checkpointet blev genoptaget. Filene er genskabt på `cursor/english-exercise-flow-7151`. Beskyttede filer er ikke ændret.

## Matrix

| Modul | Status | Testet i denne omgang | Mangler |
| --- | --- | --- | --- |
| Sprogvalg `lang.js` | Implementeret | Enhedstest: `/en/`, `?lang=en`, gemt da/en, skandinavisk browser, deep link | Automatisk browser-redirect testes ikke i Chrome, fordi webdriver tælles som bot |
| Login, gæst, fejl, reload | Implementeret | Browser: engelsk login, forkert login, reload bliver engelsk, skift til dansk | Illustrations-tekst er brændt ind i billedet |
| Forside, tårn, emnekort | Delvist | Browser: engelsk gæstehjem, “2 problems” efter rigtigt svar | Lærerportalen i `app.js` er ikke oversat |
| Plus-drill | Implementeret for loopet | Browser: forkert svar, rigtigt svar, hint, dansk kontrol, mobil | Heatmap-aria for hvert felt er ikke fuldt dækket |
| Øvrige drills i `app.js` (tal, minus, tabel, PEMDAS, negative, 0/1, kolonner, slikkepind, lån) | Ordbog for de faste sætninger | Kun plus-drill kørt i browseren | Dynamiske sætninger, som ikke matcher et mønster, bliver danske |
| Brøk-lektion, forkort, plus/minus | Mange faste sætninger | Ikke kørt i browseren i dette checkpoint | Resten af de dynamiske feedbacks |
| 10’er-venner, foodtruck, godbidder til Marley | Faste sætninger | Ikke kørt i browseren | Nogle sammensatte sætninger |
| Øbbe-tilråb på skærmen | Oversat | Ikke kørt | MP3-filerne er stadig danske |
| Skak, vinkler, brøk-løb | Kun enkelte overskrifter | Ikke kørt | Åbne PR #64, #65, #67, #69. Spillenes egne sætninger er danske. Gates er urørt |
| Cookie-samtykke | Oversat i shadow DOM | Browser venter på “May we measure visits?” | — |
| Plus-penalhus | Beskyttet, dansk med vilje | Browser: titel og hint bliver danske på engelsk | Se handoff |
| Ur (`clock*.js`) | Beskyttet, dansk med vilje | Browser: `Lær timeviseren` bliver dansk | Se handoff |
| Marley-butik / PR #34 | Parkeret, dansk | Ikke åbnet | Røres ikke |
| Erling FPS | Ikke oversat | Ikke kørt | Hele `fps.html` plus stemmer. “slapper” må ikke rettes |
| Bogstavlyde | Instruktion på engelsk, ord på dansk | Ikke kørt | Dyrenavne skal matche den danske lyd |
| Indbrændt billedtekst | Ikke oversat | Set på login-billedet | Kræver nye billeder, ikke en ordbog |
| Android | Uden for opgaven | — | Bygges ikke her |

## Indbrændt og indlejret tekst

- Login-billedet `assets/figurer/jacobmatematik-cinematic-world-v1.webp` har malet tekst: titlen “BYG MATEMATIKFÆRDIGHEDER…”, skilte og “SKOLE”. Alt-teksten kan oversættes. Pixlerne kan ikke.
- FPS-kortet på login er HTML i `fps-trial-entry.js`, ikke et billede. `ERLING FPS` og `SPIL NU ✎` rammer ordbogen. `PRØV UDEN LOGIN` og `Regn. Tjen blyanter. Overlev skolen.` gør ikke. Det er et hul.
- Hjemmets ur-kort har SVG-ordene `MINUTTER`, `I` og `OVER` i `app.js`. De er ikke oversat.
- Vinkelspillene tegner enkelte SVG-tekster. De er ikke dækket.
- Plus-penalhus og uret tegner cifre og danske sætninger i kode. Ingen separat billedfil med indbrændt sætning er fundet i dette checkpoint.

## Test

- `node scripts/test-i18n.cjs` dækker sprogvalg, de centrale sætninger, at “Jeg slapper din matematik-eksamen!” ikke bliver rettet, at Luigi stadig er `it-IT-DiegoNeural`, og at de beskyttede filer ikke nævner oversættelseslaget.
- `node scripts/shot-i18n.cjs` kører gæst på engelsk og dansk, forkert plus-svar, rigtigt svar, reload, forkert login, Plus-penalhus og uret. Skærmbilleder ligger i `/opt/cursor/artifacts` og er ikke en del af sitet.

## Næste leverance, hvis Jacob siger go til mere kode

1. Ubeskyttet og testklart: kør de samme browsertrin for brøk, 10’er-venner, foodtruck, PEMDAS og gange-drill, og luk de sætninger testen viser. FPS-kortets to resterende sætninger hører med. Det er ét afgrænset lag oven på den nuværende ordbog.
2. Stadig ubeskyttet, men større: lærerportalen i `app.js`, og derefter skak, vinkler og brøk-løb når PR #64, #65, #67 og #69 ikke længere konflikter. Gates må ikke ændres.
3. Fuld paritet er blokeret af Codex for ur og Plus-penalhus, af PR #34 for Marley-butikken, og af lyd plus indbrændte billeder for FPS og login-maleriet. Det er ikke den næste leverance.
