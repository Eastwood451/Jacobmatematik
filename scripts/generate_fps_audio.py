"""Generate fixed Danish FPS voices: edge-tts and imageio-ffmpeg are build-only.

Run with the dependencies available in Python, e.g. via PYTHONPATH=.audio-build/deps.
Existing final clips are kept unless --force is passed. No synthesis runs in-game.
"""
import argparse
import asyncio
import json
import subprocess
import tempfile
from pathlib import Path

import edge_tts
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "figurer" / "audio"


async def main(force=False):
    manifest = json.loads((ROOT / "fps-voice-lines.json").read_text(encoding="utf-8"))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    with tempfile.TemporaryDirectory(prefix="erling-danish-audio-") as temporary:
        for line in manifest["lines"]:
            final = OUTPUT / f'{line["id"]}.mp3'
            if final.exists() and not force:
                print(f"Keeping {final.name}", flush=True)
                continue
            profile = manifest["profiles"][line["character"]]
            raw = Path(temporary) / "voice.mp3"
            for attempt in range(3):
                try:
                    await edge_tts.Communicate(line["text"], **profile, volume="+8%").save(str(raw))
                    break
                except Exception:
                    if attempt == 2:
                        raise
                    await asyncio.sleep(1 + attempt)
            filtered = Path(temporary) / "normalized.mp3"
            tone = "equalizer=f=180:t=q:w=1:g=3," if line["character"] == "erling" else ""
            subprocess.run([
                ffmpeg, "-y", "-loglevel", "error", "-i", str(raw),
                "-af", "highpass=f=70,lowpass=f=6500," + tone
                + "acompressor=threshold=-18dB:ratio=3:attack=5:release=90,"
                "loudnorm=I=-16:TP=-1.5:LRA=7,alimiter=limit=0.92",
                "-codec:a", "libmp3lame", "-b:a", "96k", str(filtered)
            ], check=True)
            # Decode the complete clip before publishing it as a game asset.
            subprocess.run([ffmpeg, "-v", "error", "-i", str(filtered), "-f", "null", "-"], check=True)
            final.write_bytes(filtered.read_bytes())
            print(f"Created {final.name}: {final.stat().st_size} bytes ({profile['voice']})", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Regenerate existing FPS clips")
    asyncio.run(main(parser.parse_args().force))
