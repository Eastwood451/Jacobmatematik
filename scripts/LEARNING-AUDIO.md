# Danish learning audio pronunciation fix

The shipped Christel recordings expanded sentence-ending abbreviations. Local
Whisper-small recognition reproduced these examples from the original assets:

| Clip | Before | After regeneration |
| --- | --- | --- |
| `sum-3-2.mp3` | 3 plus 2 giver femininum | 3 plus 2 giver 5 |
| `sum-4-1.mp3` | 4 plus 1 giver femininum | 4 plus 1 giver 5 |
| `sum-8-2.mp3` | 8 plus 2 giver tirsdag | 8 plus 2 giver 10 |
| `sum-9-1.mp3` | 9 plus 1 giver tirsdag | 9 plus 1 giver 10 |
| `f-fisk.mp3` | ends in Femininom | names F in both phrases |
| `g-gris.mp3` | ends in Gift | names G in both phrases |
| `t-tiger.mp3` | ends in tidende | names T in both phrases |
| `u-ugle.mp3` | ends in udskiftet | names U in both phrases |

All 118 plus/count clips and 29 active alphabet clips were regenerated and
checked with local speech recognition. No occurrences of the unwanted expansion
terms remained in that scan. Recognition is approximate, especially for isolated
letter names; the scan checks for these specific expansions, not a perfect
phonetic transcription of every letter.

All 147 clips also decoded and played to completion in English-language Chromium,
with browser speech synthesis disabled. The existing full Plus-penalhus test
passed, including counting queues, sum feedback, real playback and cleanup.
The narration regression checks and lazy-loading startup checks passed.

The generator retains the Danish Christel voice and uses sentence-ending
exclamation marks and explicitly written Danish letter names. Versioned audio
URLs and updated shell/module script versions invalidate cached recordings.
