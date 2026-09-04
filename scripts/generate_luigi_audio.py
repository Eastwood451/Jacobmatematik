import asyncio
import os
import subprocess
from pathlib import Path

import certifi


if os.environ.get("CODEX_PROXY_CERT"):
    certifi.where = lambda: os.environ["CODEX_PROXY_CERT"]

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "figurer" / "audio"
VOICE = "it-IT-DiegoNeural"
STEM = "nummer-treogtres"
TEXT = "Jeg bager nummer treogtres med ni pepperoni og syv champignon."


async def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    raw = OUTPUT / f".luigi-{STEM}-raw.mp3"
    final = OUTPUT / f"luigi-{STEM}.mp3"
    await edge_tts.Communicate(
        TEXT,
        VOICE,
        rate="-4%",
        pitch="+3Hz",
        volume="+5%",
    ).save(str(raw))
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error", "-i", str(raw),
            "-af",
            "highpass=f=80,lowpass=f=7000,"
            "equalizer=f=300:t=q:w=1:g=2,"
            "equalizer=f=2600:t=q:w=1.2:g=1.5,"
            "acompressor=threshold=-18dB:ratio=2.5:attack=5:release=90,"
            "loudnorm=I=-16:TP=-1.5:LRA=7,"
            "alimiter=limit=0.92",
            "-codec:a", "libmp3lame", "-b:a", "96k", str(final),
        ],
        check=True,
    )
    raw.unlink()


if __name__ == "__main__":
    asyncio.run(main())
