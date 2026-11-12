# Google Play: status, udkast og mangler

Dette er et internt udkast til den lukkede test. Det er ikke en ny privatlivspolitik på sitet, og det ændrer ikke elevdata. Ingenting her må merges til `main`, før Jacob har sagt go.

## Hvad appen er

Appen `dk.jacobmatematik.app` er en Trusted Web Activity. Ikonet åbner https://jacobmatematik.dk/ i Chrome. Når Digital Asset Links er på plads, skjules browserbjælken. Indhold, login, lyd og navigation er websidens, ikke kode i APK'en.

`targetSdk` og `compileSdk` er 36. Det er Play-kravet for nye apps og opdateringer fra 31. august 2026. `minSdk` er 24. Der er ingen reklamer og ingen indsamlings-SDK'er i APK'en. Reklame-id er fjernet. Appen beder ikke om placering, mikrofon, kamera, kontakter eller notifikationer.

Upload-nøglens SHA-256:

`8B:A0:7C:96:15:8E:CD:DF:C7:BD:A6:F0:A1:EF:5D:33:4D:ED:09:D5:17:0B:57:29:0E:D4:0C:9A:73:81:D4:E6`

## Digital Asset Links

`/.well-known/assetlinks.json` indeholder upload-nøglen og Play App Signing-nøglen. Play-nøglens SHA-256 er `9F:87:16:87:2A:9C:7D:A7:1C:61:A4:E2:15:63:70:24:5C:6D:B9:A6:96:2C:F0:CF:12:91:E4:5A:CE:71:90:B7`. Den står i samme `sha256_cert_fingerprints`-liste som upload-nøglen. Hvis Play Console senere viser flere fingeraftryk, skal de også med. Uden det fingeraftryk, der signerede den installerede APK, vises browserbjælken.

`www.jacobmatematik.dk` svarer i dag med en omdirigering til apex. Asset links skal ligge på `https://jacobmatematik.dk/.well-known/assetlinks.json` og returnere HTTP 200 med `Content-Type: application/json` uden omdirigering. Repoet har allerede `.nojekyll`, så mappen kan udgives af GitHub Pages.

## Families og “bare en webview”

Families-politikken siger, at en app ikke må have som hovedformål at vise en webview af et website uden tilladelse fra ejeren. Spam-politikken bruger samme formulering, og eksemplet er en app, der pakker en andens website ind.

Risikoen er lav, men den er ikke nul:

- Sitet er Jacobmatematiks eget, fulde undervisningsprogram, ikke en andens side og ikke et affiliatelink. Tilladelsen fra ejeren ligger i samme projekt.
- Appen bruger Trusted Web Activity i Chrome. Den indlejrer ikke en WebView. Hvis Chrome mangler, er reserven en Custom Tab, så login bliver i browseren og ikke i en separat WebView-cookiekrukke.
- Play opdaterede i 2023 Families-reglen, så eget webindhold må bruges.

Rest-risikoen er, at en reviewer stadig kalder en tynd wrapper for “merely a webview”. Derfor er der en lille, afgrænset app-funktion: en offline-side.

`sw.js` gør kun dette:

- Den gemmer kun `/offline.html`.
- Den rører ikke scripts, lyd, Supabase eller andre kald end dokumentnavigation.
- Et vellykket svar sendes uændret videre. En omdirigering gives tilbage som en ny omdirigering, så den endelige adresse og relative links bevares.
- Kun når netværket fejler, vises offlinesiden. Øvelserne caches ikke, og online-adfærden er den samme.

Service workeren registreres fra forsiden og den engelske forside, og kun på jacobmatematik.dk, www, localhost og 127.0.0.1. Den er ikke aktiv, før branchen er merget.

## Login, lyd og navigation i appen

Det er ikke kørt på en telefon. Forventningen ud fra koden:

- Login er Supabase `signInWithPassword` i siden. Sessionen ligger i Chromes lager for jacobmatematik.dk (`localStorage`, nøglen `sb-uxbrnmcbvxgpsvdbzcov-auth-token`). En verificeret TWA deler det lager med Chrome. Gæstelogin opretter ikke en konto.
- Der er ikke OAuth-redirect i loginnet, så der skal ikke en særlig retur-URL til.
- Talesyntese (`speechSynthesis`) bruges af Obbe, Dennis og Elses “Dumpet!”. Den kører i Chrome på enheden. Dansk stemme findes kun, hvis telefonen har en. Manglende stemme gør ikke øvelsen ubrugelig, men oplæsningen kan blive stille eller falde tilbage til en anden stemme.
- Erling FPS afspiller færdige MP3-filer. Luigis stemme og Erlings “slapper”-linje er ikke ændret. De afhænger ikke af telefonens talesyntese. Chrome kan stadig kræve et tryk, før lyd starter. Det er samme regel som i browseren.
- Navigation på sitet bliver i appen. Links til andre domæner, for eksempel GitHub eller Googles politikker, åbner uden for TWA-tilliden.
- Siden kan sende en engelsksproget browser videre til `/en/`. Appens startadresse er stadig den danske forside.

## Analytics og børn

Google Analytics 4, målings-id `G-G4CQCVHLVR`, ligger i `analytics.js`. Tagget hentes først efter et eksplicit ja på jacobmatematik.dk. Afvisning eller intet valg sender ikke noget. Annoncemåling, personalisering og Google-signaler er slået fra. Hændelser må kun indeholde øvelses-id, øvelsesnavn, antal svar, antal rigtige og varighed. Koden sender ikke elevnavn, e-mail, login eller klasse med. Sideadressen til målingen er en fast sti uden søgestreng.

Det er et problem i en almindelig browser, fordi et barns tryk på “Accepter statistik” ikke er et gyldigt forældresamtykke. I Android-appen er tagget og cookiebanneret slået fra. `analytics.js` gemmer `jm-android-app=1` i `sessionStorage`, når `document.referrer` begynder med `android-app://dk.jacobmatematik.app`, og springer derefter både banner og gtag over, også ved senere sidevisninger i samme session. Et almindeligt browserbesøg uden den referrer og uden flaget er uændret. APK'en er ikke bygget om. Den loader stadig websitet, og ændringen ligger i websitet.

## Privatlivspolitik

Der findes allerede en side, der kan sættes ind i Play:

https://jacobmatematik.dk/privatliv.html

Den beskriver statistikcookies, lokal sletning af resultater og sletning af selve kontoen. Den linker til https://jacobmatematik.dk/slet-konto.html. Sletningen virker først, når Edge Function og migrationen er deployet. Den side er stadig ikke en fuld app-privatlivspolitik: der er ikke fundet et særskilt kontaktpunkt ud over det, der står andre steder.

Usikkerheder, som ikke er opfundet her: Der er ikke fundet en postadresse eller en særlig privatlivs-mail i repoet. Kontakt om rettigheder går i dag til GitHub-siden fra `rettigheder.html`. Supabase-projektets land eller region står ikke i repoet. Der står ikke, om lærerkonti er oprettet med en rigtig mail uden for denne klient.

### Udkast til tilføjelse, dansk

Teksten nedenfor er et udkast til Jacob. Den skal ikke sættes live, før han har læst den. Den beskriver kun det, koden og den nuværende privatlivsside viser.

> Jacobmatematik, også som Android-appen Jacobmatematik, drives af Jacob Elgaard. Appen åbner websitet jacobmatematik.dk.
>
> Du kan bruge mange øvelser som gæst uden konto. En konto bruger et brugernavn og en adgangskode. Brugernavnet gemmes som profil. Adgangskoden sendes til Supabase Auth, så du kan logge ind. Den mailadresse, loginnet bruger, er ikke en mail, du indtaster. Den dannes af brugernavnet og ender på users.jacobmatematik.invalid eller, for æ, ø og å, på unicode.users.jacobmatematik.invalid. Sessionen gemmes i browseren på enheden.
>
> Selvoprettede elever giver samtykke til, at resultater og Erling-highscore gemmes lokalt på enheden. De sendes ikke til Supabase. Knappen “Slet data” sletter de lokale resultater og highscoren på enheden. Kontoen bliver stående.
>
> Elever, som en lærer opretter, og elever der allerede lå i lærerens klasser, kan få navn, brugernavn og øvelsesresultater gemt i Supabase, så læreren kan følge arbejdet. Læreren kan rette elevens navn, brugernavn og adgangskode.
>
> Øvelsesranglister kan vise et navn og en score for andre i den sammenhæng, ranglisten er beregnet til. Erling online bruger et kaldenavn, du selv skriver. Det vises for de andre i rummet. Rummet er midlertidigt. Der er ikke fundet en fri chat.
>
> Talesyntese kører på enheden. Der optages ikke mikrofon i koden. Færdige lydfiler afspilles fra sitet.
>
> Google Analytics bruges kun i en almindelig browser, og kun efter ja til statistik. I Android-appen vises cookiebanneret ikke, og tagget hentes ikke.
>
> Supabase-klienten hentes fra jsDelivr. Det CDN ser det almindelige kald efter scriptfilen.
>
> Vi sælger ikke oplysningerne. Der er ikke reklamer i appen.
>
> Du kan slette kontoen på https://jacobmatematik.dk/slet-konto.html og under “Slet konto”, når du er logget ind. “Slet data” fjerner kun lokale resultater og beholder kontoen. En lærerkonto med elever slettes ikke. Elevernes konti og resultater bliver.
>
> Kontakt i dag: henvendelsen om rettigheder på GitHub-siden, som `rettigheder.html` linker til. En direkte mailadresse er ikke sat ind her, fordi den ikke står i materialet.

## Kontosletning

Play-stien er bygget i websitet, som appen viser. Den virker først, når migrationen og Edge Function er deployet. Det er ikke gjort i denne branch, og der er ikke slettet nogen rigtig konto.

- I appen: knappen “Slet konto” for en logget ind bruger, der ikke er gæst. Dialogen beder om brugernavn og adgangskode.
- På websitet: https://jacobmatematik.dk/slet-konto.html på dansk og engelsk. Siden kan bruges uden at installere appen. Samme adresse sættes i Play Console som slette-URL, når den er live.
- “Slet data” under tårnet er uændret. Den sletter lokale resultater og beholder kontoen.
- Funktionen `delete-own-account` bruger kun den indloggede brugers JWT. Et bruger-id i kaldet ignoreres. Service-role-nøglen ligger kun i funktionens miljø, ikke i websitet eller APK'en.
- Elev: auth-brugeren slettes. Profil, resultater, highscore-rækker og leaderboard-valg følger med de eksisterende `on delete cascade`. Eleven fjernes fra lærerens `school_state.users`. Klasserne og de andre elever bliver. Læreren kan ikke længere se elevens resultater. En skakkamp, hvor eleven er hvid eller sort, slettes for begge, fordi tabellen allerede har `on delete cascade` på begge spillere.
- Lærer med mindst én elev: sletning afvises. Elevernes konti og resultater bliver. Migrationen skifter lærer-nøglen fra `on delete cascade` til `on delete restrict`, så databasen også nægter at tage eleverne med, hvis nogen sletter lærerprofilen direkte.
- Lærer uden elever: lærerprofilen og lærerens klasseliste slettes. Der er ingen elevrækker at røre.
- Lokalt slettes `jm-local-progress-v1:<bruger-id>` og `jm-local-consent-v1:<bruger-id>`. Sprogvalg og andre enhedsindstillinger uden bruger-id bliver liggende. Usikkerhed: lokale spilnøgler, der ikke er bundet til kontoens id, er ikke alle gennemgået.

Deploy, i denne rækkefølge, og kun når Jacob vil have det i produktion:

```sh
supabase db query --linked < supabase/migrations/20261111180000_restrict_teacher_delete.sql
supabase functions deploy delete-own-account --project-ref uxbrnmcbvxgpsvdbzcov
```

Hvis projektet ikke er linket, kan SQL'en køres i Supabase SQL-editoren for `uxbrnmcbvxgpsvdbzcov`. Funktionen skal have de miljøvariabler, Supabase selv sætter: `SUPABASE_URL`, `SUPABASE_ANON_KEY` og `SUPABASE_SERVICE_ROLE_KEY`. Deploy ikke fra denne branch automatisk.

## Udkast til Data safety

Svar ærligt. APK'en indsamler ikke selv. Det, websitet gør inde i appen, tæller med.

- Indsamles eller deles der brugerdata? Ja.
- Krypteret under overførsel? Ja. Klienten bruger HTTPS til sitet og til `https://uxbrnmcbvxgpsvdbzcov.supabase.co`. Der er ikke set en klartekst-forbindelse i appen.
- Sælges data? Nej. Der er ikke fundet salg eller reklamedeling i koden.
- Kan brugeren bede om sletning af kontoen? Ja, når migrationen og `delete-own-account` er deployet. Stien i appen er “Slet konto”. Webadressen er https://jacobmatematik.dk/slet-konto.html. Indtil deploy siger siden, at sletning ikke er slået til endnu. En lærer med elever kan ikke slette sin konto. Elevernes data bliver.
- Kontooprettelse: brugernavn og adgangskode, når serveren tillader det. Ikke OAuth. Gæst kræver ikke konto.

Datatyper at oplyse som indsamlet, fordi de forlader enheden:

- Navn: brugernavn og det navn, en lærer kan sætte på en elev. Usikkerhed: alle steder, navnefeltet skrives, er ikke gennemgået række for række. Lærerflowet i `SUPABASE_SETUP.md` omtaler redigering af elevens navn.
- Bruger-id: Supabase-brugerens id.
- Anden identifikator: den syntetiske loginadresse. Det er ikke en mail, eleven indtaster.
- Adgangskode: sendes til Supabase Auth for at oprette session. Appen gemmer den ikke selv. Opsætningsnoten siger, at Auth står for hashing. Selve hash-metoden er ikke kontrolleret her.
- App-aktivitet: øvelsesresultater for elever, hvis lagring er serveren (`results` med `student_id` og `data`). Selvoprettede lokale resultater sendes ikke til serveren og skal ikke oplyses som indsamlet, så længe det stadig passer.
- App-interaktion og enheds-id efter cookie-ja: kun i en almindelig browser. Android-appen indlæser ikke Google Analytics og viser ikke cookiebanneret.
- Rangliste: navn og score kan vises for andre i ranglistens sammenhæng. Kaldenavn i Erling online vises for de andre i rummet.

Ikke fundet i koden, og derfor ikke noget der skal oplyses som indsamlet: præcis placering, kontakter, fotos, mikrofonoptagelse, helbred, økonomi, sms, kalender, reklame-id fra APK'en.

Tredjeparter: Supabase er backend. jsDelivr leverer Supabase-biblioteket og ser det kald. Google Analytics er ikke aktiv i Android-appen. I en almindelig browser er Google modtager kun efter statistik-ja.

## Målgruppe og indhold

Målgruppe i koden og på sitet: folkeskoleelever og deres lærere. Det omfatter børn. Families-reglerne gælder, når børn er en del af målgruppen. Der er ikke en aldersport i koden.

Indhold, som det ser ud i koden:

- Matematikøvelser, tårn, brøker, tabeller og lignende.
- Erling FPS: førstepersonsspil hvor man skyder med blyanter, kan få en minigun, og møder tegneseriefigurer. Gunnar tåler flere skud og sender grønne klatter. Deathmatch til 10 point med genopstandelse, og co-op over bølger. Der er ikke fundet en blod- eller gore-grafik i de filer, der blev søgt. Volden er tegneserieagtig, men det er stadig skyderi, også mod de andre spilleres figurer.
- Sprog: replikkerne er komiske og kan være drillende. Erlings “slapper” er en bevidst replik og er ikke ændret. Der er ikke fundet seksuelt indhold eller hasard om rigtige penge.
- Online: kaldenavn på op til 18 tegn, synligt for de andre i rummet. Der er ikke fundet et filter og ikke en fri chat. Det er stadig brugerindhold. Families-reglen om moderation er ikke opfyldt af et uset filter.
- Ingen køb i appen. Ingen reklamer i APK'en. Websitets cookievalg er beskrevet ovenfor.

IARC bør svares som mild tegneserievold, brugerinteraktion online via kaldenavn, uden deling af præcis placering og uden digitale køb. En sandsynlig vurdering er PEGI 7 eller 12. Den kan ikke loves her. Skyderi mellem elever kan blive spurgt ind til i Families-gennemgangen.

## Butiksliste, som Play også kræver

Ikke lavet i denne branch, fordi de ikke ligger i AAB'en:

- Kort og lang beskrivelse på dansk.
- Ikon 512. `assets/captain-erling-icon-512.png` kan bruges.
- Feature graphic 1024×500.
- Mindst to telefonscreenshots.
- En testkonto, hvis Play spørger, fordi dele af sitet kræver login. Gæst virker til en del øvelser. Opret ikke en rigtig elev i forbindelse med denne branch.

## Trin i Play Console

1. Opret appen som gratis app med navnet Jacobmatematik og standardsprog dansk. Udgiv ikke til produktion.
2. Slå Play App Signing til. Upload den signerede AAB. Upload-nøglen bliver liggende hos dig og må ikke i git.
3. Play-signeringsnøglens SHA-256 `9F:87:16:87:2A:9C:7D:A7:1C:61:A4:E2:15:63:70:24:5C:6D:B9:A6:96:2C:F0:CF:12:91:E4:5A:CE:71:90:B7` står i `assetlinks.json` ved siden af upload-nøglen. Bjælken skjules, når den fil er live, og den installerede app er signeret med en af nøglerne i listen.
4. Udfyld butikslisten, inklusive de grafikfiler der mangler.
5. Sæt privatlivs-URL til https://jacobmatematik.dk/privatliv.html og slette-URL til https://jacobmatematik.dk/slet-konto.html, efter at sitet er merget og slettefunktionen er deployet.
6. Reklamer: nej. Reklame-id: nej.
7. Målgruppe: børn er inkluderet. I appen indlæses Google Analytics ikke.
8. Udfyld IARC og Data safety ud fra udkastet. Kontosletning kan svares ja, når funktionen er deployet. En lærer med elever kan ikke slette sin egen konto.
9. Opret et lukket testspor. Tilføj mindst 12 testere. De skal blive i testen i 14 sammenhængende dage, før en ny personlig udviklerkonto kan søge om produktion. Denne branch starter ikke det spor.
10. Tjek på en rigtig telefon: login, gæst, en øvelse, lyd i FPS, dansk talesyntese, og at bjælken forsvinder først når asset links indeholder den nøgle, den installerede app er signeret med.

## Bevidst ikke ændret

Plus-penalhuset, klokke-modulet, Luigis stemme, Erlings “slapper”-replik, adgangsgates, elevdata og PR om Marley er ikke rørt. Supabase-data er ikke ændret. Live-sitet ændres ikke, før branchen merges.
