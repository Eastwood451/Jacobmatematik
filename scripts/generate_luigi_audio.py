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
# Diego spells unknown clusters as letters ("og syv" -> "O-G-S-Y-V"), so the tail is written
# Italian-phonetically: "o siu" sounds like Danish "og syv" ("å syu") with Luigi's accent.
# Segments are synthesised separately, loudness-matched and joined with short pauses.
SEGMENTS = [  # (spoken text, rate, pause after in seconds)
    ("Jeg bager nummer treogtres...", "-15%", 0.45),  # pause at the dash
    ("med ni pepperoni...", "-15%", 0.30),
    ("o siu champignon!", "-25%", 0.35),  # slower so the ending is clear
]
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
        inputs, chains = [], []
        for index, (text, rate, pause) in enumerate(SEGMENTS):
            raw = Path(tmp) / f"part-{index}.mp3"
            # Slightly higher pitch for an excited Luigi.
            await edge_tts.Communicate(text, VOICE, rate=rate, pitch="+6Hz", volume="+5%").save(str(raw))
            inputs += ["-i", str(raw)]
            chains.append(
                f"[{index}:a]aresample=24000,{TRIM},loudnorm=I=-18:TP=-3:LRA=7,aresample=24000,"
                f"afade=t=in:d=0.01,areverse,afade=t=in:d=0.02,areverse,apad=pad_dur={pause}[s{index}]"
            )
        joined = "".join(f"[s{i}]" for i in range(len(SEGMENTS)))
        chains.append(f"{joined}concat=n={len(SEGMENTS)}:v=0:a=1,adelay=120,{FILTER}")
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(chains),
             "-codec:a", "libmp3lame", "-b:a", "96k", str(final)],
            check=True,
        )


if __name__ == "__main__":
    asyncio.run(main())
