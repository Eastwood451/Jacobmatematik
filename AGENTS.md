# AGENTS.md

## Projektet

JacobMatematik er en dansk, responsiv læringsplatform til elever og lærere. Siden er bygget i ren HTML, CSS og JavaScript og bruger Supabase til login, klasser og progression, når Supabase er konfigureret.

## Arkitektur

- `index.html`: dokumentstruktur, metadata og indlæsning af scripts.
- `styles.css`: al styling og responsivt layout.
- `app.js`: øvelser, navigation, UI-state og lokal fallback.
- `supabase-backend.js`: browserklient til auth, klasser og resultater.
- `supabase-config.js`: offentlig browserkonfiguration. Tilføj aldrig service-role-nøgler eller andre hemmeligheder.
- `supabase/`: SQL og databaseopsætning.
- `assets/`: billeder og lyd, der hører til øvelserne.

Der er ingen bundler, framework eller package manager.

## Arbejdsregler

- Bevar dansk som UI-sprog.
- Bevar touch- og mobilvenlig adfærd; kontroller både smal mobilvisning og desktopvisning ved UI-ændringer.
- Genbrug eksisterende komponentmønstre, farvelogik og lagringsmodeller før du introducerer nye.
- Ændr ikke Supabase-skema, RLS-politikker eller loginflow uden at gennemgå de tilhørende filer i `supabase/`.
- Commit aldrig adgangskoder, service-role-nøgler, elevdata eller andre hemmeligheder.
- Når `app.js`, `styles.css` eller backend-scriptet ændres, skal de tilhørende cache-busting query-parametre i `index.html` vurderes og normalt opdateres, så produktionen ikke serverer en gammel fil.
- Store nye mediefiler bør ikke lægges i repoet uden en udtrykkelig beslutning om lagring.
- Arbejd i en separat branch og lever ændringer som diff eller pull request. Merge ikke til `main` uden udtrykkelig besked.

## Lokal kørsel

Start siden fra repoets rod:

```bash
python3 -m http.server 8000
```

Åbn derefter `http://localhost:8000`.

Uden Supabase-konfiguration skal demotilstanden fortsat virke via browserens `localStorage`.

## Minimumskontrol

Kør altid de relevante kontroller før aflevering:

```bash
node --check app.js
node --check supabase-backend.js
```

Ved UI-ændringer skal den berørte øvelse gennemføres i browseren, inklusive mindst ét korrekt og ét forkert svar samt skift mellem mobil- og desktopbredde. Ved login-, klasse- eller progressionsændringer skal både lokal fallback og Supabase-path vurderes.

Afslut med en kort opsummering af ændrede filer, faktisk udførte kontroller og eventuelle resterende risici.
