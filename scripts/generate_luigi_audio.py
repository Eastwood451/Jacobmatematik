import asyncio
import os
import subprocess
import tempfile
from pathlib import Path

import certifi


if os.environ.get("CODEX_PROXY_CERT"):
    certifi.where = lambda: os.environ["CODEX_PROXY_CERT"]

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "figurer" / "audio"
# Luigi's Italian accent is part of the character: always it-IT-DiegoNeural.
VOICE = "it-IT-DiegoNeural"
STEM = "nummer-treogtres"
TEXT = "Jeg bager nummer 63 - med 9 pepperoni og 7 champignon!"
# Numbers written as Danish words so the Italian voice says Danish numbers.
# The two halves are synthesised separately and joined with a clear pause at the dash.
SPOKEN_PARTS = ["Jeg bager nummer treogtres...", "med ni pepperoni... og syv champignon!"]
DASH_PAUSE = 0.45
TRIM = (
    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
    "silenceremove=start_periods=1:start_threshold=-45dB,areverse"
)
FILTER = (
    "highpass=f=80,lowpass=f=7000,"
    "equalizer=f=300:t=q:w=1:g=2,"
    "equalizer=f=2600:t=q:w=1.2:g=1.5,"
    "acompressor=threshold=-18dB:ratio=2.5:attack=5:release=90,"
    "loudnorm=I=-16:TP=-1.5:LRA=7,"
    "alimiter=limit=0.92"
)


async def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    final = OUTPUT / f"luigi-{STEM}.mp3"
    with tempfile.TemporaryDirectory(prefix="luigi-audio-") as tmp:
        parts = []
        for index, text in enumerate(SPOKEN_PARTS):
            raw = Path(tmp) / f"part-{index}.mp3"
            # Slower rate for intelligibility, slightly higher pitch for an excited Luigi.
            await edge_tts.Communicate(text, VOICE, rate="-15%", pitch="+6Hz", volume="+5%").save(str(raw))
            parts.append(raw)
        subprocess.run(
            [
                "ffmpeg", "-y", "-loglevel", "error", "-i", str(parts[0]), "-i", str(parts[1]),
                "-filter_complex",
                f"[0:a]{TRIM},apad=pad_dur={DASH_PAUSE}[a];[1:a]{TRIM},apad=pad_dur=0.35[b];"
                f"[a][b]concat=n=2:v=0:a=1,adelay=120,{FILTER}",
                "-codec:a", "libmp3lame", "-b:a", "96k", str(final),
            ],
            check=True,
        )


if __name__ == "__main__":
    asyncio.run(main())
