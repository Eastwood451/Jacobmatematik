# Marley pet scene assets

**Hero motion (preferred):** Jacob Imagine Logre — ~3s stand-wag loop (Grok Imagine I2V), not free frame→WebM.
Soft-ffmpeg / free premium1 clips = Jacob **FAIL**. Spec: `/workspace/marley/ai-out/premium/LOGRE-QUALITY-BAR.md`.

| File | Role |
|------|------|
| **wag-loop.webm** (+ `.mp4`) | Logre + idle wag — `<video muted loop playsinline>` (Imagine Logre) |
| **wag-loop-still.png** | poster + prefers-reduced-motion idle / video-unavailable still |
| **walk-loop.webm** (+ `.mp4`) | Løb / roam walk segments — same video plate (pending Imagine batch) |
| stand.png / marley-cutout.png | still / missing-video fallback |
| walk-a.png, walk-b.png | **degraded** walk swap when walk-loop absent |
| wag-a.png, wag-b.png | **degraded** wag swap when wag-loop absent |
| sit.png, lie.png | sit / lie / bed / sleep |
| sunglasses.png | eyes overlay (~28% down bbox) |

**Cache:** `?v=20261007-logre1`

**Source (wired):** `jacob-imagine-wag-loop.{webm,mp4,-still.png}` from `/workspace/marley/ai-out/premium/`
(Do **not** use full `jacob-imagine-wag.*` — stands→lies, not loopable.)

**Aliases probed (after marley-pet/):** `assets/marley-premium/wag-loop.*`, `walk-loop.*`, then plan short names `wag.*` / `walk.*` under `assets/marley-premium/` only.
Do **not** use soft-ffmpeg clips in `assets/figurer/marley-premium/` as the default.

Canon: `marley-canon.png` · spec: `LOGRE-QUALITY-BAR.md` / `IMAGINE-QUALITY-BAR.md`
