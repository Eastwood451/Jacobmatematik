"""Erling: "Jeg slapper din matematik-eksamen!" with "slapper" = Danish-accented English "slap" + "-per".

A plain Danish read gives the back Danish a of "slapper" (= slappe af). A Dane saying the English
"slap" uses the front a of Danish "hat". Both lines are synthesised with Erling's exact FPS voice;
the front vowel is taken from "slatter" (same position, same prosody) and spliced into the
"slapper" line just before the p closure with a 25 ms crossfade, so the consonants stay s-l-a-p-p-e-r
and the rest of the line is untouched. Measured vowel (LPC): plain F1~690/F2~1190 Hz (back),
spliced F1~450/F2~1630 Hz (front, like Danish "hat", towards English "slap").
"""
import asyncio
import subprocess
import tempfile
from pathlib import Path

import edge_tts
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
FINAL = ROOT / "assets" / "figurer" / "audio" / "erling-matematik-eksamen.mp3"
VOICE = dict(voice="da-DK-JeppeNeural", rate="-11%", pitch="-15Hz", volume="+8%")  # fps-voice-lines.json "erling"
BASE = "Jeg slapper din matematik-eksamen!"
VOWEL_SOURCE = "Jeg slatter din matematik-eksamen!"
CUT = 0.645  # s: end of the a-vowel / start of the p closure in both renders
XFADE = 0.025
SR = 24000
FILTER = (
    "highpass=f=70,lowpass=f=6500,equalizer=f=180:t=q:w=1:g=3,"
    "acompressor=threshold=-18dB:ratio=3:attack=5:release=90,"
    "loudnorm=I=-16:TP=-1.5:LRA=7,alimiter=limit=0.92"
)


def decode(path: Path) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


async def main() -> None:
    with tempfile.TemporaryDirectory(prefix="erling-slapper-") as tmp:
        base, vowel = Path(tmp) / "base.mp3", Path(tmp) / "vowel.mp3"
        await edge_tts.Communicate(BASE, **VOICE).save(str(base))
        await edge_tts.Communicate(VOWEL_SOURCE, **VOICE).save(str(vowel))
        a, t = decode(base), decode(vowel)
        c, xf = int(CUT * SR), int(XFADE * SR)
        ramp = np.linspace(0, 1, xf, dtype=np.float32)
        out = np.concatenate([t[:c - xf], t[c - xf:c] * (1 - ramp) + a[c - xf:c] * ramp, a[c:]])
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                        "-af", FILTER, "-ar", "48000", "-codec:a", "libmp3lame", "-b:a", "96k", str(FINAL)],
                       input=out.tobytes(), check=True)


if __name__ == "__main__":
    asyncio.run(main())
