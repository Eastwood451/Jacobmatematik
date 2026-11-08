# Handoff til Codex: engelsk tekst i beskyttede moduler

Dette dokument er **ikke** en patch. Det må ikke køres, og det må ikke flettes ind i `plus-penalhus.js` eller `clock*.js`. De filer ejes af Codex. Øvelserne skal blive synlige og danske, indtil ejeren selv oversætter dem, eller Jacob ophæver begrænsningen.

Det engelske lag i `i18n.js` springer `.pp-game`, `.cl-module` og `.marley-page` over. Det er et bevidst stop, ikke en oversættelse ad bagvejen. Kortene på forsiden kan være engelske. Indholdet inde i modulerne er stadig dansk.

Checkpoint 8. november 2026. Intet er udgivet.

## Rør ikke

- Luigis stemme er `it-IT-DiegoNeural` i `scripts/generate_luigi_audio.py`. Den må ikke skiftes, heller ikke hvis Plus-penalhus eller uret får nye engelske klip.
- Erlings replik `Jeg slapper din matematik-eksamen!` er bevidst. “Slapper” er engelsk *slap* med dansk tryk, ikke “slappe af”. Den ligger i `fps-voice-lines.json` og `scripts/generate_erling_slapper_audio.py`.
- Plus-penalhus-lyd genereres med `da-DK-ChristelNeural` (`scripts/generate_plus_penalhus_audio.py`). Nye engelske klip skal ikke bruge Luigis italienske stemme.
- Marley-butikken og PR #34 røres ikke i dette spor.

## Aftalte navne

- Øbbe Øvdig → Paul Practice (kort: Paul)
- Erling Ærgerlig → Isaac Isuck

Luigi bliver Luigi. Øvrige engelske navne i øvelsesfladen er arbejdsnavne, ikke ny kanon: Captain Square Root, Division Dennis, Else the Examiner, Gunnar the Slacker.

## Plus-penalhus (`plus-penalhus.js`)

Kortet på forsiden er allerede engelsk (“Pencil-case addition”). Selve spillet er dansk. Bekræftet i browseren 8. november: overskriften blev `Plus-penalhus`, og hintet blev `Klik på Øbbe og Luigi`, også efter skift til engelsk.

| Dansk | Foreslået engelsk |
| --- | --- |
| Plus-penalhus: Øbbe og Luigi | Pencil-case addition: Paul and Luigi |
| ← Tilbage | ← Back |
| 0 rigtige / 1 rigtigt | 0 correct / 1 correct |
| Øbbe & Luigi · penalhuset | Paul & Luigi · the pencil case |
| Plus-penalhus | Pencil-case addition |
| Klik på figurerne, så de kaster ting ud. Tæl dem bagefter! | Tap the characters so they throw things. Then count them! |
| Plusstykke | Addition |
| Dit svar | Your answer |
| Øbbe Øvdig / Øbbe | Paul Practice / Paul |
| Luigi Lækkermat | Luigi |
| Penalhus-ting på bordet | Pencil-case things on the table |
| Klik på Øbbe og Luigi | Tap Paul and Luigi |
| Hvor mange ting er der i alt? | How many things are there altogether? |
| Tæl alle tingene på bordet. Tryk på en ting for at markere den, mens du tæller. | Count everything on the table. Tap a thing to mark it as you count. |
| Tastatur / Tast {n} / Slet sidste tal | Keypad / Key {n} / Delete the last digit |
| Tjek svar | Check answer |
| Næste plusstykke → | Next addition → |
| Hvor mange ting er der i alt? Tæl dem én ad gangen. | How many things are there altogether? Count them one by one. |
| Sådan! {a} + {b} = {n}. Der er {n} ting i alt! | Yes! {a} + {b} = {n}. There are {n} things altogether! |
| Svaret kunne ikke gemmes. Tryk igen. | The answer could not be saved. Tap again. |
| Tæl dem en gang til | Count them once more |
| Øbbe og Luigi gør sig klar … | Paul and Luigi are getting ready … |
| Klik {a} gange på Øbbe og {b} gange på Luigi. | Tap Paul {a} times and Luigi {b} times. |
| Øbbe Øvdig er færdig med at kaste {a} ting | Paul Practice has finished throwing {a} things |
| Øbbe Øvdig — klik for at kaste. {klik} af {a} kastet, {rest} tilbage | Paul Practice — tap to throw. {klik} of {a} thrown, {rest} left |
| Luigi Lækkermat er færdig med at kaste {b} ting | Luigi has finished throwing {b} things |
| {ting} fra Øbbe, talt / ikke talt | {thing} from Paul, counted / not counted |
| Animationerne kunne ikke hentes. Prøv at åbne øvelsen igen. | The animations could not be loaded. Open the exercise again. |

Ting-navnene (blyant, viskelæder, lineal, vinkelmåler og resten) ligger i datalisten øverst i filen. De skal med, ellers siger skærmlæseren danske ord. Der er ingen tekst brændt ind i penalhus-billederne, som dette checkpoint har fundet. Lydklippene er danske og skal optages på ny, hvis spillet skal være engelsk.

## Uret (`clock.js`, `clock-core.js`, `clock-course.js`)

Kortet “Learn the clock” er engelsk på forsiden. Modulet er dansk. Bekræftet i browseren: overskriften blev `Lær timeviseren`, ikke en engelsk sætning. Kursus-knapperne (`Tilbage`, `Frem`, `Fri træning`, `Til oversigten`, `Start øvelsen`) og Luigis forklaring blev også danske.

Foreslået ur-sprog, så “i / over / halv / kvart” ikke bliver halvt oversat:

| Dansk | Engelsk |
| --- | --- |
| minutter over | minutes past |
| minutter i | minutes to |
| halv | half past |
| kvart over | quarter past |
| kvart i | quarter to |
| hele timer | o’clock |
| den korte / lille viser | the hour hand |
| den lange / store viser | the minute hand |
| LÆR KLOKKEN | LEARN THE CLOCK |
| LÆR KLOKKEN MED LUIGI | LEARN THE CLOCK WITH LUIGI |
| Hvad er klokken? | What time is it? |
| Læs uret. Gør sætningen færdig. | Read the clock. Finish the sentence. |
| Lær timeviseren / Minutviseren / Begge visere / Hele timer | Learn the hour hand / The minute hand / Both hands / O’clock |
| Én ting ad gangen. Først hver viser for sig. | One thing at a time. First each hand on its own. |
| Fri træning / Til oversigten / Frem / Tilbage | Free practice / Overview / Next / Back |
| Vis hjælp / Skjul hjælpelinjer | Show help / Hide guide lines |
| Venstre: I / Højre: OVER | Left: TO / Right: PAST |
| Udfyld det tomme felt først. | Fill the empty box first. |
| Du har læst 10 ure! | You have read 10 clocks! |
| {n} rigtige i første forsøg. Godt arbejdet! | {n} correct on the first try. Well done! |
| Træk den lange viser. Du kan også bruge piletasterne. | Drag the minute hand. You can also use the arrow keys. |
| Et ur har to visere. Vi begynder med den lille viser. Den viser timerne. | A clock has two hands. We start with the small hand. It shows the hours. |

`clock-core.js` har forklaringerne til hver vending. De skal oversættes som ét forløb. Rød side er PAST, blå side er TO. Hjemmets ur-kort har SVG-teksten `MINUTTER` / `I` / `OVER`. Den ligger i `app.js`, ikke i ur-filerne, og er bevidst ikke oversat, fordi den hører til den danske ur-pædagogik.

Ur-skiven i kurset er tegnet i kode. Tallene er cifre. Der er ikke fundet engelsk/dansk tekst brændt ind i en ur-billedfil i dette checkpoint.

## Når ejeren er klar

1. Læg engelske strenge ind i de tre ur-filer og i `plus-penalhus.js`, eller udvid ordbogen og fjern `.pp-game` / `.cl-module` fra skip-listen. Det sidste er en adfærdsændring og kræver ejerens ja.
2. Behold dansk, når `jm-lang` er `da`.
3. Oversæt ikke lyd i samme ændring, medmindre nye engelske klip er optaget. Luigis stemme forbliver `it-IT-DiegoNeural`.
4. Fjern ikke øvelserne fra forsiden for at få dækningen til at se færdig ud.
