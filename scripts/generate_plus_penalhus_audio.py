"""Build prerecorded Danish counting and equations; no TTS runs in-game.

Christel is the Danish female Edge voice. Generate in one narration and split at
word boundaries so even short counts (en/to) receive complete audio reliably.
pip install edge-tts imageio-ffmpeg; python scripts/generate_plus_penalhus_audio.py
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
    lines = [(f"count-{n}", NUMBERS[n].capitalize() + ".") for n in range(1, 19)]
    lines += [(f"sum-{a}-{b}", f"{NUMBERS[a].capitalize()} plus {NUMBERS[b]} giver {NUMBERS[a+b]}.")
              for a in range(10) for b in range(10)]
    if all((OUTPUT / f"{stem}.mp3").exists() for stem, _ in lines):
        return
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    with tempfile.TemporaryDirectory(prefix="plus-penalhus-audio-") as tmp:
        raw = Path(tmp) / "narration.mp3"
        # Batches keep service requests short and can retry without losing earlier clips.
        for at in range(0, len(lines), 20):
            batch = lines[at:at + 20]
            if all((OUTPUT / f"{stem}.mp3").exists() for stem, _ in batch):
                continue
            for attempt in range(6):
                boundaries = []
                try:
                    with raw.open("wb") as audio:
                        async for chunk in edge_tts.Communicate(
                            " ".join(text for _, text in batch), VOICE,
                            rate="-10%", boundary="WordBoundary"
                        ).stream():
                            if chunk["type"] == "audio":
                                audio.write(chunk["data"])
                            elif chunk["type"] == "WordBoundary":
                                boundaries.append(chunk)
                    expected = [word.strip(".").lower() for _, text in batch for word in text.split()]
                    actual = [b["text"].strip(".").lower() for b in boundaries]
                    assert actual == expected, (actual, expected)
                    break
                except Exception:
                    if attempt == 5:
                        raise
                    await asyncio.sleep(2 + attempt)
            cursor = 0
            for stem, text in batch:
                words = len(text.split())
                first, last = boundaries[cursor], boundaries[cursor + words - 1]
                cursor += words
                start = max(0, first["offset"] / 10_000_000 - .035)
                end = (last["offset"] + last["duration"]) / 10_000_000 + .09
                final = OUTPUT / f"{stem}.mp3"
                subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(raw),
                                "-ss", str(start), "-t", str(end - start),
                                "-af", "loudnorm=I=-16:TP=-1.5:LRA=7",
                                "-codec:a", "libmp3lame", "-b:a", "64k", str(final)], check=True)
                subprocess.run([ffmpeg, "-v", "error", "-i", str(final), "-f", "null", "-"], check=True)
                print(f"Created {stem}: {text}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
