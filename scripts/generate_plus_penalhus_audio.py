"""Generate complete, independent Danish utterances. Never cut at word timestamps.

pip install edge-tts imageio-ffmpeg
python scripts/generate_plus_penalhus_audio.py
Only leading/trailing silence is trimmed, retaining 60ms around all speech.
"""
import asyncio
import argparse
import os
import re
import subprocess
import tempfile
from pathlib import Path

import certifi
if os.environ.get("CODEX_PROXY_CERT"):
    certifi.where = lambda: os.environ["CODEX_PROXY_CERT"]
import edge_tts
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets/figurer/plus-penalhus/audio-v2"
VOICE = "da-DK-ChristelNeural"


def narration_lines():
    # Numeric cardinal input avoids the voice treating "Fem." as an abbreviation.
    lines = [(f"count-{n}", f"{n}!") for n in range(1, 19)]
    # Cardinal input prevents "fem." being expanded to "femininum" and
    # "ti" being spelled as initials. Keep the complete utterance intact.
    for a in range(10):
        for b in range(10):
            suffix = '-ti-v3' if a + b == 10 else '-fem-v4' if a + b == 5 else ''
            right = 'nul,' if b == 0 else str(b)
            lines.append((f"sum-{a}-{b}{suffix}", f"{a} plus {right} giver {a+b}!"))
    return lines


async def build_clips(lines, output=OUTPUT, force=False):
    output.mkdir(parents=True, exist_ok=True)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    limit = asyncio.Semaphore(2)

    async def generate(stem, text):
        final = output / f"{stem}.mp3"
        if not force and final.exists() and final.stat().st_size > 1000:
            return
        async with limit:
            with tempfile.TemporaryDirectory(prefix="plus-whole-voice-") as tmp:
                raw = Path(tmp) / "whole.mp3"
                repeated = False
                for attempt in range(8):
                    # Some very short utterances are rejected by the service.
                    # Repeat them if necessary, then split only at an actual silent gap.
                    repeated = stem.startswith("count-") and attempt >= 3
                    try:
                        await edge_tts.Communicate(text + (" " + text if repeated else ""),
                                                   VOICE, rate="-10%", boundary="WordBoundary").save(str(raw))
                        break
                    except Exception:
                        if attempt == 7:
                            raise
                        await asyncio.sleep(2 + attempt)
                trim = []
                if repeated:
                    result = subprocess.run([ffmpeg, "-i", str(raw), "-af",
                                             "silencedetect=noise=-55dB:d=0.25", "-f", "null", "-"],
                                            capture_output=True, text=True, check=True)
                    gaps = re.findall(r"silence_start: ([0-9.]+).*?silence_end: ([0-9.]+)",
                                      result.stderr, flags=re.S)
                    gaps = [(float(a), float(b)) for a, b in gaps if float(a) > .15]
                    if not gaps:
                        raise RuntimeError(f"No safe silent gap in repeated {stem}")
                    trim = ["-t", str(gaps[0][0] + .12)]
                subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(raw), *trim,
                                "-af", "silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.06,"
                                "areverse,silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.06,"
                                "areverse,loudnorm=I=-16:TP=-1.5:LRA=7",
                                "-codec:a", "libmp3lame", "-b:a", "64k", str(final)], check=True)
                subprocess.run([ffmpeg, "-v", "error", "-i", str(final), "-f", "null", "-"], check=True)
                print(f"Created {stem}: {text} (complete utterance)", flush=True)
    await asyncio.gather(*(generate(stem, text) for stem, text in lines))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Replace existing recordings")
    args = parser.parse_args()
    asyncio.run(build_clips(narration_lines(), force=args.force))

