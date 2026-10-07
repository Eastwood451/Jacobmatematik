"""Independent Danish ASR review of actual shipped audio, including fire/fem."""
import json
import re
import subprocess
import tempfile
import wave
from pathlib import Path
import numpy as np
from faster_whisper import WhisperModel
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
OUT = ROOT / "test-results/plus-penalhus"
OUT.mkdir(parents=True, exist_ok=True)
model = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=4)


def read_audio(paths):
    with tempfile.TemporaryDirectory() as tmp:
        # Repetition gives ASR enough context to recognize otherwise tiny isolated clips.
        args = [FFMPEG, "-y", "-loglevel", "error"]
        for p in paths:
            args += ["-i", str(p)]
        wav = Path(tmp) / "review.wav"
        args += ["-filter_complex", "".join(f"[{i}:a]" for i in range(len(paths)))
                 + f"concat=n={len(paths)}:v=0:a=1", "-ar", "16000", str(wav)]
        subprocess.run(args, check=True)
        with wave.open(str(wav), "rb") as audio:
            samples = np.frombuffer(audio.readframes(audio.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        segments, _ = model.transcribe(samples, language="da", beam_size=5,
                                       condition_on_previous_text=False)
        return " ".join(s.text.strip() for s in segments)


old = ROOT / "assets/figurer/plus-penalhus/audio"
new = ROOT / "assets/figurer/plus-penalhus/audio-v2"
report = {}
for name, folder in [("previous_counts", old), ("new_counts", new)]:
    report[name] = read_audio([folder / f"count-{n}.mp3" for n in [4, 5, 4, 5]])
report["new_equation"] = read_audio([new / "sum-5-3.mp3"] * 2)
(OUT / "pronunciation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
# ASR may render spoken numbers as digits. Require both problem counts and all
# three equation numbers, without prompting the model with the expected words.
counts = report["new_counts"].lower()
assert re.search(r"\b(fire|4)\b", counts), counts
assert re.search(r"\b(fem|5)\b", counts), counts
equation = report["new_equation"].lower()
for word, digit in [("fem", "5"), ("tre", "3"), ("otte", "8")]:
    assert re.search(rf"\b({word}|{digit})\b", equation), equation
print("PASS: independent Danish speech recognition identifies fire, fem and 5 + 3 = 8.")
