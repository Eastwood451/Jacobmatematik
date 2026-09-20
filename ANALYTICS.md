# Google Analytics

GA4 property: `552527373`, web stream: `15639748245`, measurement ID: `G-G4CQCVHLVR`.

`analytics.js` is included on the home, FPS and privacy pages. It loads Google's tag only on `jacobmatematik.dk` and `www.jacobmatematik.dk`, after an explicit opt-in. Local and preview visits never load the tag. Consent is stored for 180 days, with blocked storage handled as a session-only choice. Withdrawal disables measurement, updates consent, removes GA cookies and propagates across open tabs.

Only page-level visits are measured; exercise transitions, pupil identities, class data, login, answers and scores are not sent. URLs and titles are fixed to public page names. Referrers are omitted. Ads consent stays denied, and Google Signals/personalization are disabled. Enhanced measurement was disabled in the GA web stream: keep it off to avoid automatic form, link and history collection. Internal exercise views are intentionally not separate page views.

The Danish consent panel links to `privatliv.html`. Users can reopen it with Cookieindstillinger. Cookie settings and the panel use a shadow root so app/game CSS cannot override them.

Test with `node scripts/test-analytics.cjs` with Playwright in `NODE_PATH` and Chrome installed. Google and Supabase network calls are intercepted; no real visitor events or database writes are made. Screenshot: `test-results/analytics/mobile.png`.

Deployment: GitHub Pages publishes the root of `main`. After deployment, accept statistics on the live site and check GA Realtime for `page_view`. Tag installation checkers may report a missing tag when they have not accepted cookies. Standard reports are delayed.

References: https://developers.google.com/tag-platform/security/guides/consent and https://developers.google.com/analytics/devguides/collection/ga4/reference/config
