# Incoming! Et spil om vinkler!

Incoming is a public angle game (the same access as Skak and Brøk-løb when `INCOMING_PUBLIC` is true). Kaptajn Kvadratrod stands in the centre of a 3D arena. Dummerter, Erlinger, papers marked “DUMPET”, spitballs and remoulade sandwiches fly towards him. Enter an angle from 0 to 360, then click **Fyr!** or press Enter to fire a mathematical symbol.

| Angle | Screen direction |
| --- | --- |
| 0° / 360° | Right |
| 90° | Up |
| 180° | Left |
| 270° | Down |

The camera uses equal horizontal and vertical scale, preserving these directions on both desktop and mobile. Swept segment collision checks prevent fast shots from passing through enemies. Only the first intercepted enemy scores a hit. Five shields and eight incoming enemies per wave are included. Wave 1 attacks only from 0°, 90°, 180° and 270°; wave 2 uses 45° steps, wave 3 uses 5° steps, and from wave 4 every whole degree (0–359). 0° and 360° are the same direction. Three difficulty settings change speed and how many enemies appear at once, not the angle steps. Pause/resume, replay and optional aiming/angle guides are included.

## Visibility and navigation

`canPlayIncoming` follows `gameModuleEnabled` while `INCOMING_PUBLIC` is true: any logged-in student, teacher or guest can play, including Jacob’s “Se som elev”. Set the flag to `false` to restore the previous `ANGLES_PROFILE_IDS` allowlist (Jacob’s two profiles only, not guests, not “Se som elev”). Visibility, click handling and mount-after-loading each check this condition, including an identity check after asynchronous loading.

- Students, teachers and guests: Andre genveje → Incoming! Et spil om vinkler!
- Jacob’s teacher profile can still open it from Sandbox or the Front-end practice shortcuts.
- `?start=incoming` uses the same shortcut and does not bypass the gate.
- Back returns to Sandbox when launched there, otherwise to the current profile’s home screen.
- Logged-out visitors still see no card; they start as a guest first, like the other games.

The game does not create users or save practice results. Existing Vinkler/Skak availability and backend permissions are unchanged. The Vinkler lesson (piberenser, Vinkel-ord and Ram vinklen) is already public; Incoming is the 3D Kaptajn Kvadratrod game.

## Animation and sound

`incoming.js` builds animated 3D meshes with the existing local Three.js r158 library: blue suit, red mask and moving cape, square-root chest emblem, arm movement, recoil, tumbling enemies and hit particles. Portrait references continue using the existing character gallery assets.

Eight authored Danish MP3 files are included, so the device’s browser language cannot select an English voice for Danish text:

1. Tag dén, dummert!
2. Lad klogheden sejre!
3. Æd mit sigma!
4. Plus på dig, Erling!
5. Gå hjem og læs!
6. Smag på mit gangetegn!
7. Jeg brøk'er dig midt over!
8. Kom nærmere - matematik-tæsk på tilbud!

Speech uses Danish JeppeNeural, lowered in pitch and processed with EQ/compression. `scripts/generate_incoming_audio.py` regenerates these clips using `edge-tts` and FFmpeg. Repeated shots do not queue a backlog of voices. Pause, mute, navigation and teardown stop playback. English UI/captions are provided; the authored voice clips are Danish and are played only in the Danish UI.

WebGL is the default renderer. If unavailable, `incoming-renderer.js` projects the same scene and camera into Canvas2D, retaining all game mechanics. Reduced-motion settings reduce ambient movement and particle counts. Hiding the tab pauses the game. Navigation disposes graphics, observers, audio and animation frames.

![Incoming beta in the CPU fallback renderer](incoming-preview.jpg)

## Verification

Run from the repository root:

```sh
node scripts/test-incoming-core.cjs
node scripts/test-incoming-gating.cjs
node scripts/test-lazy-load-startup.cjs
node scripts/test-student-view.cjs
```

Core checks cover cardinal and arbitrary angles, 0/360 equivalence, the angle step per wave, invalid input, misses, nearest-target swept collisions, cooldown, pause, all five enemy types, wave completion and game over. Access checks cover the public flag for student, teacher and guest, the closed-flag allowlist, identity changes during loading, teardown and all eight MP3s.

Manual browser QA covers a 360° rightward hit, score, pause, language switching without resetting score/input, sandbox return, both profile entry points, hidden cards for other profiles, and a 390-pixel mobile iframe. The test browser disables WebGL, so these browser checks use the CPU fallback; the hardware WebGL rendering path still needs a device smoke test. All eight shipped MP3s decode successfully with FFmpeg.

Publication scope: with `INCOMING_PUBLIC` set to true, Incoming is available to every student, teacher and guest. The allowlist remains in the code so the game can be closed again without a new gate.
