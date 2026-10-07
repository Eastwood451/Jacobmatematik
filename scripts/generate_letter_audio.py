"""Build Danish alphabet recordings with explicit spoken letter names.

pip install edge-tts imageio-ffmpeg
python scripts/generate_letter_audio.py --force
"""
import argparse
import asyncio
import re

from generate_plus_penalhus_audio import ROOT, build_clips

OUTPUT = ROOT / "assets/letters/audio"
# Bare letters followed by a full stop can be expanded as abbreviations
# (F. -> femininum, G. -> gift, T. -> tidende, U. -> udskiftet).
LETTER_NAMES = dict(zip(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ",
    ["a", "be", "se", "de", "e", "æf", "ge", "hå", "i", "jåd", "kå",
     "æl", "æm", "æn", "o", "pe", "ku", "ær", "æs", "te", "u", "ve",
     "dobbelt ve", "æks", "y", "sæt", "æ", "ø", "å"],
))


def narration_lines():
    app = (ROOT / "app.js").read_text(encoding="utf-8")
    items = app.split("const LETTER_ITEMS = [", 1)[1].split("].map", 1)[0]
    letters = re.findall(r'\["([A-ZÆØÅ])","([^"]+)","([^"]+)\.webp"\]', items)
    if [letter for letter, _, _ in letters] != list(LETTER_NAMES):
        raise ValueError("Every alphabet letter must have an explicit Danish spoken name")
    return [
        (stem + ("-v2" if letter in ["L", "N"] else ""),
         f"Bogstavet {LETTER_NAMES[letter]} som i {word}! "
         f"{word.capitalize()} starter med bogstavet {LETTER_NAMES[letter]}!")
        for letter, word, stem in letters
    ]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Replace existing recordings")
    args = parser.parse_args()
    asyncio.run(build_clips(narration_lines(), output=OUTPUT, force=args.force))
