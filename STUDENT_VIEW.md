# Se som elev / View as student

Implemented on `codex/student-view`; draft review only. No merge, deployment or database migration.

## Behaviour

- Entry is restricted to the existing Jacob teacher profile ID already used by the application's beta gates.
- A separate presentation flag hides teacher/admin controls, the existing front-end/back-end switch, sandbox and Jacob-only beta modules. Published modules remain available.
- The authenticated user object, user ID, role and backend permissions are retained. No profile is created or impersonated.
- A fixed, responsive banner shows “Du ser som elev” / “You are viewing as a student”, the storage explanation and a return button. It is outside the application render root and survives exercise navigation. Session state restores after reload.
- The banner is also installed on the FPS, English landing, rights and privacy entry points. Returning from a separate page clears the presentation flag and opens the main app. FPS's Jacob-specific reduced kill target is suppressed in student view.
- Returning restores the teacher interface and the existing beta gates. Logout clears the presentation flag.

## Progression decision

Jacob explicitly answered **yes** to saving his own progression. The backend currently permits shared result insertion only for eligible student profiles. To preserve real permissions and avoid writing into student records, this feature saves Jacob's existing result array locally under `jm-student-view-results:<Jacob ID>`.

This is device/browser-specific, not cross-device Supabase persistence. Existing results emitted by exercises are captured, including by an autosave once per second and on page hide/visibility change. Standard answer handling and exit also save. Modules that do not emit progress retain their existing behaviour. A storage failure is displayed in the banner. No consent flag, role, credential, school state or student result is modified by the feature. Clearing browser site data removes this local progression.

Protected module files, render functions and audio are unchanged: Plus-penalhuset, clock, Luigi voice and Marley. Only shared navigation/disposal invokes their existing lifecycle functions.

## Verification — 2026-11-09

Passed:

- `node --check app.js`, `node --check student-view.js`
- `node scripts/test-student-view.cjs`: identity/role isolation, local save, rebind without duplication, reload, exit, rejection of other profiles.
- `node scripts/test-i18n.cjs`: 1,375 semantic keys.
- `node scripts/test-angles-gating.cjs`: existing gates plus student-view denial.
- `SKIP_BROWSER=1 node scripts/test-brok-loeb-gating.cjs`
- `node scripts/test-angle-games-gating.cjs`
- `git diff --check`
- Source comparison against the branch base: `renderClock`, `renderPlusPenalhus`, `renderMarleyAddition` and `renderMarley` unchanged.
- Chromium browser integration fixture at `/scripts/student-view-browser-test.html`, served locally: **43 assertions passed**, at 1280 and 390 CSS pixels. Tests exercise entry, exit, actual arithmetic submission, DA/EN switching, beta route denial, logout, reload and restored progress. The return control fits both widths with a minimum 44px height.
- Browser assertions confirm unchanged user identity/role and student records, no result/server writes or authentication changes while previewing, and no uncaught browser errors.

The browser fixture uses in-memory profiles and a stub backend; it does not create a real student or authenticate to Supabase. It refuses to run outside localhost. Serve the repository root and open that path to repeat it. No live-account or production-write test was performed. Separate-page FPS gameplay and every exercise were not exhaustively browser-tested.
