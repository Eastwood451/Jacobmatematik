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
TEXT = (
    "Jeg er kommet for at tygge tyggegummi og mogge regnestykker! "
    "Og jeg har ikke mere tyggegummi!"
)


async def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    raw = OUTPUT / ".kaptajn-kvadratrod-raw.mp3"
    final = OUTPUT / "kaptajn-tyggegummi-og-regnestykker.mp3"
    await edge_tts.Communicate(
        TEXT,
        VOICE,
        rate="-8%",
        pitch="-25Hz",
        volume="+10%",
    ).save(str(raw))
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error", "-i", str(raw),
            "-af",
            "highpass=f=55,lowpass=f=6000,"
            "bass=g=5:f=140:w=.7,"
            "equalizer=f=190:t=q:w=1:g=4,"
            "equalizer=f=2600:t=q:w=1.2:g=2,"
            "acompressor=threshold=-22dB:ratio=4:attack=4:release=120,"
            "aecho=0.8:0.16:45|95:0.12|0.055,"
            "loudnorm=I=-15:TP=-1.2:LRA=8,"
            "alimiter=limit=0.94",
            "-codec:a", "libmp3lame", "-b:a", "112k", str(final),
        ],
        check=True,
    )
    raw.unlink()


if __name__ == "__main__":
    asyncio.run(main())
