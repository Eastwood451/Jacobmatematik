# Forslag til jacobmatematik.dk

Site-wide knap + modal, hvor brugere (inkl. gæster) kan sende feedback til Jacob. Beskeder gemmes i Supabase og vises i lærerportalen for registration-administratoren (Jacob).

## Status

Koden ligger i repoet. **Migrationen er ikke kørt i produktion.** Jacob skal give Go, før den anvendes.

## Hvad der er bygget

| Del | Fil(er) |
|---|---|
| DB + RLS/RPC | `supabase/migrations/20261113153000_site_suggestions.sql` |
| Knap + modal | `suggestions.js`, `suggestions.css` (indlæst fra `index.html` og SEO-landinger) |
| API-hjælpere | `supabase-backend.js` (`submitSiteSuggestion`, `listSiteSuggestions`, `deleteSiteSuggestion`) |
| Admin-tabel | `app.js` (panel i lærerportalen, kun når `canManageRegistrations`) |
| DA/EN-tekster | `i18n-strings.js` + engelsk hardcodet i `suggestions.js` til `/en/`-landinger |

## Adgangsmodel

- **Indsend:** alle (anon + authenticated) via RPC `submit_site_suggestion`
- **Brugernavn:** hentes fra `profiles.username` når brugeren er logget ind; ellers `Gæst`
- **Læs/slet:** kun `registration_administrators` via `can_manage_self_registered()` → RPC `list_site_suggestions` / `delete_site_suggestion`
- Spam-beskyttelse: 1–2000 tegn, honeypot i modalen, klient-cooldown 60 s, max 5 forslag/time pr. indlogget bruger

## Deploy (efter Go fra Jacob)

1. **Merge ikke automatisk** – gennemgå PR først.
2. Anvend migrationen i Supabase-projektet `uxbrnmcbvxgpsvdbzcov`, fx:
   - Supabase Dashboard → SQL → kør indholdet af `supabase/migrations/20261113153000_site_suggestions.sql`, **eller**
   - `supabase db push` / `supabase migration up` med CLI peget på samme projekt.
3. Merge PR til `main`, så GitHub Pages opdaterer den statiske side.
4. Verificér:
   - Åbn forsiden → knappen i footeren → send et testforslag som gæst.
   - Log ind som Jacob → lærerportal → “Forslag til jacobmatematik.dk” → se række, sortér, eksportér CSV, slet.

## Ikke-deployet endnu

- Tabellen `site_suggestions` findes **ikke** i produktion, før migrationen køres.
- Indtil da fejler send/list/delete med RPC-fejl (UI viser fejltekst).
