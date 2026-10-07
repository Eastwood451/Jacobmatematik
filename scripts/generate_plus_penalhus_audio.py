"""Build prerecorded Danish counting and equation clips; no TTS runs in-game.

Uses Christel, the Danish female Edge voice, for the letter-module style.
pip install edge-tts imageio-ffmpeg; python scripts/generate_plus_penalhus_audio.py
Existing clips are kept. Covers all supported addends (0..9), not only today's deck.
"""
import asyncio
import os
import subprocess
import tempfile
from pathlib import Path

import certifi
if os.environ.get("CODEX_PROXY_CERT"):
    certifi.where = lambda: os.environ["CODEX_PROXY_CERT"]
import edge_tts
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets/figurer/plus-penalhus/audio"
VOICE = "da-DK-ChristelNeural"
NUMBERS = "nul en to tre fire fem seks syv otte ni ti elleve tolv tretten fjorten femten seksten sytten atten".split()


async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    lines = [(f"count-{n}", NUMBERS[n] + ".") for n in range(1, 19)]
    lines += [(f"sum-{a}-{b}", f"{NUMBERS[a]} plus {NUMBERS[b]} giver {NUMBERS[a+b]}.")
              for a in range(10) for b in range(10)]
    limit = asyncio.Semaphore(3)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

    async def generate(stem, text):
        final = OUTPUT / f"{stem}.mp3"
        if final.exists() and final.stat().st_size:
            return
        async with limit:
            with tempfile.TemporaryDirectory(prefix="plus-penalhus-audio-") as tmp:
                raw = Path(tmp) / "raw.mp3"
                for attempt in range(3):
                    try:
                        await edge_tts.Communicate(text, VOICE, rate="-10%").save(str(raw))
                        break
                    except Exception:
                        if attempt == 2:
                            raise
                        await asyncio.sleep(1 + attempt)
                subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(raw),
                                "-af", "silenceremove=start_periods=1:start_threshold=-45dB,loudnorm=I=-16:TP=-1.5:LRA=7",
                                "-codec:a", "libmp3lame", "-b:a", "64k", str(final)], check=True)
                subprocess.run([ffmpeg, "-v", "error", "-i", str(final), "-f", "null", "-"], check=True)
                print(f"Created {stem}: {text}", flush=True)

    await asyncio.gather(*(generate(stem, text) for stem, text in lines))


if __name__ == "__main__":
    asyncio.run(main())
