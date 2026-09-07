# jacobmatematik

En responsiv matematikapp til elever og lærere, bygget i ren HTML, CSS og JavaScript.

## Funktioner

- Elev- og lærerlogin
- Tallene, Plusstykker, Lille tabel, Tabel-drill, Division-drill, basisregler, regnehierarki, negative tal og distributiv lov
- Adaptiv opgavefordeling baseret på rigtighed og svartid
- Skærmtastatur til iPad og browser
- Lærerportal med klasser, elevstatistik, grafer og detaljerede opgaveresultater
- Farvekodet historik for hvert ordnet plus- og multiplikationspar
- Sessionsheatmaps for Tabel-drill og Division-drill med samme farvekodning af svartid og fejl
- Mestring efter tre hurtige korrekte svar i træk; Tallene bruger 10 sekunder, og de øvrige fartøvelser bruger 5 sekunder
- Korrekt svar vises som en trykbar illustration efter et forkert svar
- Valgfri central Supabase-database, så lærer og elever deler klasser og resultater på tværs af enheder

## Kør lokalt

Åbn `index.html` direkte i en browser. Uden Supabase-konfiguration gemmes demodata lokalt i browserens `localStorage`.

Se `SUPABASE_SETUP.md` for opsætning af central database og login.

## Danske stemmer i Erling FPS

Spillets replikker afspilles fra faste danske MP3-filer via `fps-voice.js`.
Browserens sprog og installerede oplæsningsstemmer påvirker derfor ikke udtalen.
Replikker og stemmeprofiler findes i `fps-voice-lines.json`; lydfilerne ligger i
`assets/figurer/audio/`. Nye replikker skal have en lydfil før brug.

Genopbyg med `python scripts/generate_fps_audio.py` (kræver `edge-tts` og
`imageio-ffmpeg`). Eksisterende klip bevares; `--force` regenererer dem.
`node scripts/test-fps-voice.cjs` afprøver engelsk Chrome uden browseroplæsning
(kræver Playwright). Ingen stemmegenerering eller ekstern lydtjeneste bruges under spillet.

## Webadresse

- https://jacobmatematik.dk
