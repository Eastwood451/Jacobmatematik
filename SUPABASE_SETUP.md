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
