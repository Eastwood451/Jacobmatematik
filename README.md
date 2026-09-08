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
- Erling FPS: singleplayer samt online deathmatch og co-op med rumkode til 2–4 spillere

## Erling online

Åbn `fps.html` via en webserver, vælg **Spil online med klassen** og skriv et kaldenavn.
Vælg Divisions-Dennis, Luigi Lækkermat eller Kaptajn Kvadratrod som avatar, før
du starter eller joiner serveren. Valget huskes på enheden og vises i lobbyen,
på din egen skærm og som din figur hos de andre spillere i begge spilformer.
Avatarerne har samme liv, hastighed og træffeflade.
Værten vælger deathmatch eller co-op og trykker **Start server**. De øvrige elever
indtaster koden på otte tegn eller åbner det kopierede invitationslink. Værten kan
starte kampen, når mindst to spillere er i rummet. Man kan ikke joine midt i en kamp.

- **Deathmatch:** Først til 10 point. En nedlagt modstander giver ét point. Spillere
  har fem liv, genopstår efter tre sekunder og får tre sekunders beskyttelse.
- **Co-op:** Overlev fem bølger af Erling og Gunnar i skolens indendørs bane.
  Ingen skade på holdkammerater. Faldne spillere genoplives ved næste bølge;
  hvis alle falder, taber holdet. Overlevende får ét liv tilbage mellem bølger.
- Rigtige gangestykker giver én blyant, højst 30 i beholdningen. Shift, Ctrl og
  ventilation bruger samme bevægelsesregler som singleplayer.
- Værten kan starte en ny kamp efter resultatet. Rummet lukkes, når værten forlader
  serveren; der er ingen automatisk overførsel af værtsrollen eller gemte kampe.

Online bruger den eksisterende Supabase-klient med Broadcast og Presence, uden
nye tabeller, migrations eller servernøgler. Værtens browser beregner spillet;
den skal forblive åben og aktiv. Der udsendes fem opdateringer pr. sekund med
lokal bevægelse og udjævning af de andre figurer. Kapacitetsgrænsen er fire
spillere pr. rum, og flere samtidige rum deler projektets Realtime-kvoter.
En hel klasses samtidige belastning er ikke verificeret.

Rummene er midlertidige offentlige Realtime-kanaler med tilfældige koder og
kaldenavne. De er beregnet til spil mellem klassekammerater, ikke fortrolige data
eller konkurrencer med sikker beskyttelse mod snyd. Værten validerer bevægelse,
vægge, ammunition, svar og træffere, men en modificeret klient kan forfalske
Broadcast-afsenderfelter. Skoleprofiler, elevresultater og loginoplysninger sendes
aldrig gennem spilrummene. Se [Broadcast](https://supabase.com/docs/guides/realtime/broadcast)
og [Realtime-kvoter](https://supabase.com/docs/guides/realtime/limits).

### Kontrol af multiplayer

Kør `node --test scripts/test-online.mjs` for spillereglerne. Med Playwright og
Chrome installeret kan `node scripts/test-online-browser.cjs` afprøve to isolerede
browser-sessioner gennem projektets rigtige Realtime-forbindelse. Testen åbner
midlertidige rum, prøver begge spilformer, regnesvar, et skud mellem spillerne,
lukning af serveren, ugyldig kode og singleplayer. Rum ryddes ved afslutning;
skærmbilleder gemmes i den ignorerede mappe `test-results/`.

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

## Rettigheder

Se [rettighedsmeddelelsen](LICENSE), [tredjepartslicenserne](THIRD_PARTY_NOTICES.md)
og [sidens oplysninger om brug](rettigheder.html). Offentlig adgang til
repository'et er ikke en generel open source-licens til projektets eget
beskyttede indhold. Tredjepartskomponenter følger deres egne licenser.

**Klargøring før merge:** Udfyld juridisk ejer og kontakt i `LICENSE` og
`rettigheder.html`, fjern udkastmarkeringen på rettighedssiden og gennemgå
grundlaget for at give de beskrevne tilladelser. Den afgrænsede gennemgang
af browserbiblioteker dokumenterer ikke lydtjenesternes outputrettigheder.
