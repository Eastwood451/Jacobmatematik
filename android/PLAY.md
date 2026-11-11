# Google Play: status, udkast og mangler

Dette er et internt udkast til den lukkede test. Det er ikke en ny privatlivspolitik på sitet, og det ændrer ikke elevdata. Ingenting her må merges til `main`, før Jacob har sagt go.

## Hvad appen er

Appen `dk.jacobmatematik.app` er en Trusted Web Activity. Ikonet åbner https://jacobmatematik.dk/ i Chrome. Når Digital Asset Links er på plads, skjules browserbjælken. Indhold, login, lyd og navigation er websidens, ikke kode i APK'en.

`targetSdk` og `compileSdk` er 36. Det er Play-kravet for nye apps og opdateringer fra 31. august 2026. `minSdk` er 24. Der er ingen reklamer og ingen indsamlings-SDK'er i APK'en. Reklame-id er fjernet. Appen beder ikke om placering, mikrofon, kamera, kontakter eller notifikationer.

Upload-nøglens SHA-256:

`8B:A0:7C:96:15:8E:CD:DF:C7:BD:A6:F0:A1:EF:5D:33:4D:ED:09:D5:17:0B:57:29:0E:D4:0C:9A:73:81:D4:E6`

## Digital Asset Links

`/.well-known/assetlinks.json` indeholder kun upload-nøglen. Filen ligger ikke på det live site, før denne branch er merget.

Play App Signing signerer den APK, testerne installerer, med en anden nøgle. SHA-256 for den nøgle vises først i Play Console efter upload. Den skal tilføjes i samme `sha256_cert_fingerprints`-liste. Kopiér alle fingeraftryk, som siden viser, også hvis der er flere nøgler. Uden det rigtige fingeraftryk virker appen, men med browserbjælke.

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

Det er stadig et problem for en børneapp. Målgruppen er folkeskoleelever og omfatter børn under 13. Et barns tryk på “Accepter statistik” er ikke et gyldigt forældresamtykke. GA4 modtager derefter browser- og enhedsoplysninger og IP som led i forbindelsen. APK'en indeholder ikke reklame-id, men websiden inde i appen kan stadig indlæse tagget.

Forslag, ikke implementeret, og det ændrer ikke besøg i en almindelig browser: Når `document.referrer` begynder med `android-app://dk.jacobmatematik.app`, skal `analytics.js` hverken vise banneret eller hente gtag. Chrome sætter den referrer ved start af en TWA. Almindelige besøg, iOS-genveje og afvis/accept på websitet bliver som i dag. Det bør godkendes af Jacob, før det kodes, fordi det slår måling fra for app-brugerne. Indtil da har den lukkede test samme cookievalg som websitet.

## Privatlivspolitik

Der findes allerede en side, der kan sættes ind i Play:

https://jacobmatematik.dk/privatliv.html

Den beskriver statistikcookies, lokal sletning af resultater og at kontoen beholdes. Den nævner Supabase kort. Den er ikke en fuld app-privatlivspolitik: der er ingen vej til at få selve kontoen slettet, intet særskilt kontaktpunkt ud over det, der står andre steder, og den beskriver ikke appen.

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
> Google Analytics bruges kun, hvis du accepterer statistik på websitet. Se den eksisterende tekst om cookies. Android-appen har ikke sit eget analyse-SDK.
>
> Supabase-klienten hentes fra jsDelivr. Det CDN ser det almindelige kald efter scriptfilen.
>
> Vi sælger ikke oplysningerne. Der er ikke reklamer i appen.
>
> Du kan endnu ikke få selve kontoen slettet fra appen eller fra en side på websitet. “Slet data” fjerner kun lokale resultater. En færdig slettevej skal beskrives, før den sættes på.
>
> Kontakt i dag: henvendelsen om rettigheder på GitHub-siden, som `rettigheder.html` linker til. En direkte mailadresse er ikke sat ind her, fordi den ikke står i materialet.

## Kontosletning

Play kræver, at brugere der kan oprette en konto, både kan starte sletning inde i appen og via en webside. Websiden skal kunne bruges uden at installere appen igen. Et link i appen til den side kan være den indre vej. Når en konto slettes, skal de tilhørende data også slettes. At deaktivere kontoen er ikke nok.

Det findes ikke i dag.

- “Slet data” under tårnet, i `app.js`, sletter lokale resultater og Erling-highscore for en selvoprettet elev med lokal lagring. Bekræftelsen siger, at kontoen beholdes. Det samme står på `/privatliv.html`.
- “Log ud” kalder `signOut`. Det sletter ikke brugeren.
- Der er ingen side, hvor man kan bede om at få Supabase-kontoen, profilen og eventuelle resultater slettet. `rettigheder.html` har et GitHub-link om rettigheder, ikke en slettevej.
- Klienten har `selfRegistrationEnabled = true` og spørger derefter serveren med `self_registration_enabled`. Oprettelse kan altså være åben. Et ældre afsnit i `SUPABASE_SETUP.md` siger, at Jacob lukkede selvoprettelse 22. september 2026 af hensyn til GDPR, og at den kun må åbnes efter hans udtrykkelige besked. Flaget i koden er siden sat til genåbnet med lokale resultater. Denne branch ændrer ikke det flag og ikke serveren.
- Læreren kan stadig oprette elever. De konti er også app-konti, hvis eleven logger ind i appen.

Sletning er bevidst ikke bygget her. Den skal designes og testes, før den rører Supabase: hvem må slette en læreroprettet elev, hvad der sker med klasselisten og historiske resultater, og at service-role-nøglen aldrig lægges i appen eller i websidens offentlige kode. En halv knap, der lover sletning uden at gennemføre den, er værre end et tydeligt hul.

Indtil det findes, kan Data safety-formularen ikke svares med, at brugerne kan få kontoen slettet. Det kan blokere udgivelsen, også af den lukkede test, hvis Play kræver slette-URL'en, når oprettelse er slået til.

## Udkast til Data safety

Svar ærligt. APK'en indsamler ikke selv. Det, websitet gør inde i appen, tæller med.

- Indsamles eller deles der brugerdata? Ja.
- Krypteret under overførsel? Ja. Klienten bruger HTTPS til sitet og til `https://uxbrnmcbvxgpsvdbzcov.supabase.co`. Der er ikke set en klartekst-forbindelse i appen.
- Sælges data? Nej. Der er ikke fundet salg eller reklamedeling i koden.
- Kan brugeren bede om sletning af kontoen? Nej. Se ovenfor. Lokale resultater kan slettes på enheden. Det er ikke kontosletning.
- Kontooprettelse: brugernavn og adgangskode, når serveren tillader det. Ikke OAuth. Gæst kræver ikke konto.

Datatyper at oplyse som indsamlet, fordi de forlader enheden:

- Navn: brugernavn og det navn, en lærer kan sætte på en elev. Usikkerhed: alle steder, navnefeltet skrives, er ikke gennemgået række for række. Lærerflowet i `SUPABASE_SETUP.md` omtaler redigering af elevens navn.
- Bruger-id: Supabase-brugerens id.
- Anden identifikator: den syntetiske loginadresse. Det er ikke en mail, eleven indtaster.
- Adgangskode: sendes til Supabase Auth for at oprette session. Appen gemmer den ikke selv. Opsætningsnoten siger, at Auth står for hashing. Selve hash-metoden er ikke kontrolleret her.
- App-aktivitet: øvelsesresultater for elever, hvis lagring er serveren (`results` med `student_id` og `data`). Selvoprettede lokale resultater sendes ikke til serveren og skal ikke oplyses som indsamlet, så længe det stadig passer.
- App-interaktion og enheds-id efter cookie-ja: sidevisning og de whitelisted øvelseshændelser til Google Analytics. Ikke før ja, og ikke på andre værter end produktionssitet.
- Rangliste: navn og score kan vises for andre i ranglistens sammenhæng. Kaldenavn i Erling online vises for de andre i rummet.

Ikke fundet i koden, og derfor ikke noget der skal oplyses som indsamlet: præcis placering, kontakter, fotos, mikrofonoptagelse, helbred, økonomi, sms, kalender, reklame-id fra APK'en.

Tredjeparter: Supabase er backend. Google er modtager, kun efter statistik-ja. jsDelivr leverer Supabase-biblioteket og ser det kald. Deling med en databehandler kan i formularen ofte markeres som tjenesteudbyder og ikke som “sharing” i Plays reklameforstand. GA4 efter samtykke er deling med Google og skal med, indtil app-forslaget ovenfor er lavet.

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
3. Kopiér Play-signeringsnøglens SHA-256 ind i `assetlinks.json`, og udgiv først derefter websitet, når Jacob har sagt go. Før det har testerne en browserbjælke.
4. Udfyld butikslisten, inklusive de grafikfiler der mangler.
5. Sæt privatlivs-URL til https://jacobmatematik.dk/privatliv.html, og læg slette-URL'en ind først når slettevejen findes. Den nuværende side slår ikke til alene, hvis Play kræver kontosletning.
6. Reklamer: nej. Reklame-id: nej.
7. Målgruppe: børn er inkluderet. Svar Families-spørgsmålene ud fra denne note, ikke som om analytics allerede er slået fra i appen.
8. Udfyld IARC og Data safety ud fra udkastet. Sæt kontosletning til nej, indtil funktionen er bygget og testet.
9. Opret et lukket testspor. Tilføj mindst 12 testere. De skal blive i testen i 14 sammenhængende dage, før en ny personlig udviklerkonto kan søge om produktion. Denne branch starter ikke det spor.
10. Tjek på en rigtig telefon: login, gæst, en øvelse, lyd i FPS, dansk talesyntese, og at bjælken forsvinder først når asset links indeholder den nøgle, den installerede app er signeret med.

## Bevidst ikke ændret

Plus-penalhuset, klokke-modulet, Luigis stemme, Erlings “slapper”-replik, adgangsgates, elevdata og PR om Marley er ikke rørt. Supabase-data er ikke ændret. Live-sitet ændres ikke, før branchen merges.
