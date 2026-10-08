"""Regenerate letter-learning clips (da-DK-ChristelNeural, rate -7%, raw edge-tts MP3).

Only the clips fixed on 2026-10-07 are listed; the other letters were made with the same
voice and pattern ("X som i ord. Ord starter med X."). Some words are spelled
phonetically so the voice says the letter/word clearly: "Jåd" = J, "el" = L, "ejern" = egern.
"""
import asyncio
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "letters" / "audio"
VOICE = "da-DK-ChristelNeural"
RATE = "-7%"
LINES = [
    ("e-egern", "E som i ejern. Ejern starter med E."),
    ("j-jaguar", "Jåd, som i jaguar. Jaguar starter med jåd."),
    ("l-loeve-v2", "Løve begynder med bogstavet el. El som i løve."),
    ("o-orm", "O som i orm. Orm starter med O."),
    ("oe-oekse", "Ø som i økse. Økse starter med Ø."),
]


async def main() -> None:
    for stem, text in LINES:
        await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(OUTPUT / f"{stem}.mp3"))


if __name__ == "__main__":
    asyncio.run(main())
