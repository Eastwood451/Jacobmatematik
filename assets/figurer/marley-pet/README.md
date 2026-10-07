# Marley pet scene assets

**Hero motion (preferred):** G&M Imagine / I2V loops from `marley-canon.png` only.
Drop files here when ready — `marley-pet.js` probes at runtime and falls back if missing.

| File | Role |
|------|------|
| **wag-loop.webm** (+ `.mp4`) | Logre + idle wag holds — `<video muted loop playsinline>` |
| **walk-loop.webm** (+ `.mp4`) | Løb / roam walk segments — same video plate |
| stand.png / marley-cutout.png | still / reduced-motion / missing-video fallback |
| walk-a.png, walk-b.png | **degraded** walk swap when walk-loop absent |
| wag-a.png, wag-b.png | **degraded** wag swap when wag-loop absent |
| sit.png, lie.png | sit / lie / bed / sleep |
| sunglasses.png | eyes overlay (~28% down bbox) |

**Cache:** `?v=20261007-premium1`

**Aliases probed (after marley-pet/):** `assets/marley-premium/wag-loop.*`, `walk-loop.*`, then plan short names `wag.*` / `walk.*` under `assets/marley-premium/` only.
Do **not** use soft-ffmpeg clips in `assets/figurer/marley-premium/` as the default.

Sources (WIP): `/workspace/marley/ai-out/` · canon: `marley-canon.png` · spec: `PREMIUM-AI-MOTION-PLAN.md`
