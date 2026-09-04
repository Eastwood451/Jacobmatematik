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
VOICE = "da-DK-JeppeNeural"
LINES = [
    ("hvad-skal-jeg-bruge-det-til", "Hvad skal jeg BRUGE det til?"),
    ("det-er-kedeligt", "Det er KEDELIGT!"),
    ("det-er-kun-skyer-der-regner", "Det er kun SKYER, der REGNER!"),
    ("tal-er-for-tumper", "Tal er for TUMPER!"),
    ("kloge-mennesker-er-dumme", "Kloge mennesker er DUMME!"),
]


async def create(stem: str, text: str) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    raw = OUTPUT / f".{stem}-raw.mp3"
    final = OUTPUT / f"erling-{stem}.mp3"
    await edge_tts.Communicate(
        text,
        VOICE,
        rate="-11%",
        pitch="-15Hz",
        volume="+8%",
    ).save(str(raw))
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error", "-i", str(raw),
            "-af",
            "highpass=f=70,lowpass=f=5600,"
            "equalizer=f=180:t=q:w=1:g=3,"
            "equalizer=f=2300:t=q:w=1.3:g=2.5,"
            "acrusher=bits=13:mix=0.055,"
            "acompressor=threshold=-18dB:ratio=3:attack=5:release=90,"
            "loudnorm=I=-16:TP=-1.5:LRA=7,"
            "alimiter=limit=0.92",
            "-codec:a", "libmp3lame", "-b:a", "96k", str(final),
        ],
        check=True,
    )
    raw.unlink()


async def main() -> None:
    for item in LINES:
        await create(*item)


if __name__ == "__main__":
    asyncio.run(main())
