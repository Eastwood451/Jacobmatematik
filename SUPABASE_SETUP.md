# Central database

Appen er forberedt til Supabase Auth og Postgres. Når forbindelsen er aktiveret, gemmes klasser, elevindstillinger og resultater centralt i stedet for i browserens `localStorage`.

## 1. Opret projektet

1. Opret et gratis projekt på Supabase.
2. Åbn **SQL Editor**, indsæt hele `supabase/schema.sql`, og kør scriptet.
3. Opret lærerens Auth-bruger med mailen `jacob@users.jacobmatematik.invalid` og en ny, stærk adgangskode. Markér mailen som bekræftet.
4. Kør de to kommenterede lærer-statements nederst i `supabase/schema.sql`.

## 2. Udgiv elevadministrationen

Udgiv Edge Function-mappen `supabase/functions/manage-student` som funktionen `manage-student`. Funktionen bruger Supabases indbyggede miljøvariabler og må ikke have service-role-nøglen i frontendkoden.

## 3. Forbind hjemmesiden

Kopiér Project URL og Publishable key fra Supabase-projektets **Connect**-dialog til `supabase-config.js`:

```js
window.JACOBMATEMATIK_SUPABASE = {
  url: "https://PROJEKT.supabase.co",
  publishableKey: "sb_publishable_...",
};
```

Publishable key må ligge i frontendkoden. Service-role-nøglen må aldrig placeres dér.

## 4. Kontrol

1. Log ind som `Jacob` på en computer.
2. Opret en klasse og en prøveelev.
3. Log ind som prøveeleven på en anden enhed og besvar en opgave.
4. Genindlæs lærerportalen og kontrollér, at besvarelsen vises.

Når Supabase-konfigurationen er tom, fortsætter appen midlertidigt i lokal tilstand.
