# Supabase i produktion

`jacobmatematik.dk` bruger Supabase-projektet `uxbrnmcbvxgpsvdbzcov` i organisationen `Jacobmatematik`.

## Kildekode

- Databaseskema og RLS-politikker: `supabase/schema.sql`
- Elevadministration: `supabase/functions/manage-student/index.ts`
- Supabase CLI-konfiguration: `supabase/config.toml`
- Browserklient: `supabase-backend.js`
- Offentlig projektkonfiguration: `supabase-config.js`

Databaseskema og Edge Function skal ændres i GitHub først. Deploy derefter samme version til Supabase, så drift og repository ikke afviger.

## Produktion

- Project URL: `https://uxbrnmcbvxgpsvdbzcov.supabase.co`
- Site URL: `https://jacobmatematik.dk`
- Redirect URLs:
  - `https://jacobmatematik.dk/**`
  - `https://www.jacobmatematik.dk/**`
- Edge Function: `manage-student`
- `verify_jwt = false`, fordi funktionen selv validerer brugerens access token med `auth.getUser()`.

Den publishable key i `supabase-config.js` er beregnet til browserbrug. Service-role-nøglen og databaseadgangskoder må aldrig ligge i GitHub eller frontendkode.

## Kontrol efter ændringer

1. Log ind som lærer.
2. Opret en prøveelev.
3. Rediger elevens navn, brugernavn og eventuelt adgangskode.
4. Log ind som eleven i en anden browser og gem et resultat.
5. Kontrollér i lærerportalen, at resultatet vises.

## Danske brugernavne

Brugernavne normaliseres til NFC og små bogstaver. `æ`, `ø` og `å` bevares i elevprofilen.
Eksisterende ASCII-brugernavne bruger fortsat samme interne loginadresse.
Danske brugernavne bruger SHA-256 af det normaliserede brugernavn som ASCII-lokalpart
på `unicode.users.jacobmatematik.invalid`. Browser og Edge Function skal bruge samme mapping.

Efter push skal `manage-student` genudgives i projektet `uxbrnmcbvxgpsvdbzcov`:

```sh
supabase functions deploy manage-student --project-ref uxbrnmcbvxgpsvdbzcov
```

Der kræves ingen SQL-migration og ingen ændringer af eksisterende elevkonti.
Frontend kontrollerer serverens `capabilities` før oprettelse/ændring til et dansk
brugernavn, så en gammel server ikke opretter en konto med forkert loginadresse.
Kør `node scripts/test-danish-usernames.cjs` før deploy.

## Selvoprettede brugere

Kør `supabase/migrations/202609090001_self_registration.sql` efter grundskemaet.
Migrationen bevarer eksisterende profiler og resultater. `schema.sql` beskriver
grundinstallationen; nye installationer skal også køre migrations i rækkefølge.

Oprettelse bruger Supabase Auth `signUp` og den eksisterende interne loginadresse.
Brugeren indtaster kun brugernavn og adgangskode (mindst seks tegn). Auth står for
hashing og rate limits. En databasetrigger opretter samtidig elevprofilen uden
lærer eller klasse. Brugerens metadata kan aldrig tildele lærerrolle eller klasse.
Se https://supabase.com/docs/reference/javascript/auth-signup og
https://supabase.com/docs/guides/auth/managing-user-data.

### Aktivering

1. Kør migrationen i produktion. Oprettelse er stadig slået fra.
2. Kontrollér, at `registration_administrators` indeholder Jacobs lærer-ID.
   Migrationen tilføjer kun den eksisterende lærer med brugernavnet `Jacob`.
   Ingen andre lærere får automatisk adgang til uplacerede brugere.
3. Under Authentication → Sign In / Providers: tillad nye tilmeldinger og slå
   **Confirm email** fra, da de interne brugernavnsadresser ikke er postkasser.
   Undlad at ændre eksisterende konti, adgangskoder eller deres sessioner.
4. Kør `update public.registration_settings set enabled = true where id;`.
5. Udgiv frontendfilerne og prøv ny konto, genlogin, gemt resultat, oversigt og
   klasseplacering. Der er ingen ny Edge Function at udgive.

`can_manage_self_registered` kontrollerer den beskyttede administratortabel.
Oversigten læses via `list_self_registered` med 50 rækker pr. side plus én til at
afgøre, om der er en næste side. Den viser uplacerede brugere samt administratorens
egne selvoprettede elever. Adgangskoder og andre brugeres resultater udleveres ikke.
`assign_self_registered` validerer administrator, elev og den valgte klasses ejer
og opdaterer lærerrelation og klasseliste i én transaktion. Resultater røres ikke.
En ældre åben lærerfane kan ikke fjerne den nye elev ved at gemme en gammel liste.

Før aktivering eller ved manglende migration viser oprettelsesformularen en
tydelig besked. Eksisterende login virker fortsat. Hvis en konto oprettes, men
efterfølgende indlæsning fejler, får brugeren besked om at logge ind igen.

Kontrol: `node scripts/test-self-registration.cjs` og
`node scripts/test-danish-usernames.cjs`. SQL-integrationskontrollen
`supabase/tests/self_registration.sql` køres i en testdatabase efter migrationen;
den bruger syntetiske konti og ruller hele kontrollen tilbage.
