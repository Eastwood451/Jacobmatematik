#!/usr/bin/env python3
"""Generate Danish TTS clips for the angles module (edge-tts, free)."""
import asyncio
import os
import subprocess
from pathlib import Path

import certifi
if os.environ.get("CODEX_PROXY_CERT"):
    certifi.where = lambda: os.environ["CODEX_PROXY_CERT"]

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "angles" / "audio"
VOICE = "da-DK-ChristelNeural"
LINES = [
    ("intro-piberenser", "Forestil dig, du skal bede nogen om at bøje en piberenser, så den lige præcis kan ligge i en vinklet rille. Hvordan vil du fortælle nogen, hvor meget de skal bøje piberenseren?"),
    ("intro-beskriv", "For at kunne det, skal vi kunne beskrive en bøjning – akkurat som vi kan beskrive en længde med centimeter og meter. Hvordan beskriver man en bøjning?"),
    ("intro-grader", "Ligesom en meter er delt i centimeter, er en hel runde delt i 360 små dele. Hver del hedder en grad."),
    ("intro-360", "En hel runde er 360 grader."),
    ("intro-180", "En halv runde er 180 grader – som en flad væg eller en lige snor."),
    ("intro-90", "En kvart runde er 90 grader – som hjørnet af dit bord."),
    ("task-60", "Sæt vinklen på 60 grader."),
    ("task-45", "Sæt vinklen på 45 grader."),
    ("task-15", "Sæt vinklen på 15 grader."),
    ("feel-45", "Prøv nu at sætte vinklen på 45 grader – sådan cirka."),
    ("feel-90", "Prøv nu at sætte den på 90 grader."),
    ("feel-60", "Prøv nu at sætte den på 60 grader."),
    ("hint-more", "Lidt mere."),
    ("hint-less", "Lidt mindre."),
    ("good", "Flot!"),
    ("reveal-45", "Det var 45 grader!"),
    ("reveal-90", "Det var 90 grader!"),
    ("reveal-60", "Det var 60 grader!"),
    ("pipe-intro", "Nu skal du bøje piberenseren, så den passer i rillen på 60 grader."),
    ("pipe-done", "Perfekt! Piberenseren passer!"),
    ("done", "Du har lært, hvad en vinkel er. Godt arbejdet!"),
]

async def create(stem: str, text: str) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    raw = OUTPUT / f".{stem}-raw.mp3"
    final = OUTPUT / f"angles-{stem}.mp3"
    await edge_tts.Communicate(text, VOICE, rate="-5%").save(str(raw))
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw),
         "-af", "loudnorm=I=-16:TP=-1.5:LRA=7,alimiter=limit=0.95",
         "-codec:a", "libmp3lame", "-b:a", "96k", str(final)],
        check=True,
    )
    raw.unlink(missing_ok=True)
    print("ok", final.name)

async def main():
    for stem, text in LINES:
        await create(stem, text)

if __name__ == "__main__":
    asyncio.run(main())
