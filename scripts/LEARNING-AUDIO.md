# Danish learning audio

The current Plus-penalhus uses the newer complete-utterance `audio-v2/` films:
118 counting/equation MP3s, with `-ti-v3` for sums of ten and `-fem-v4` for sums
of five. The faster-flight change and predecoded Web Audio playback remain intact.

The pronunciation proposal #40 regenerated the alphabet recordings and reported
speech-recognition checks for F → femininum, G → gift, T → tidende and U → udskiftet.
Its 24 alphabet clips without later corrections are incorporated here. The five
newer E/J/L/O/Ø clips on main are retained. All 29 active letter URLs carry a fresh
cache version, including the existing `-v2` filenames for L and N.

The old proposal's Plus-penalhus files were not selected: they use the superseded
`audio/` family and its older playback implementation. The existing newer v2
recordings and immediate click feedback remain in use.

Both generators support `--force`; each utterance is generated independently.
Numeric sums and explicit Danish letter names avoid ambiguous abbreviations.
`test-learning-audio.py` checks filenames, shipped clips, the active versions and
narration text. Decode checks verify media integrity; they do not measure pronunciation.
