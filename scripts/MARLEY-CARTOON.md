# Marley cartoon films

The active Marley module uses `marley-cartoon.js`. It plays complete painted
character performances as H.264 MP4 files at 60 fps, without a WebGL requirement
or CSS transforms on dog body parts. Artwork follows the original Marley.

There are 24 generated whole-character key drawings for wagging, running,
eating and settling into the basket, and 16 for smiling. Bidirectional dense
optical flow produces intermediate frames. This is an interpolated keyframe
animation, not a video-model generation; small texture/shape changes between
the generated drawings can remain. Source sheets are retained with the films.

`build-marley-cartoon.py` isolates each complete figure by its alpha component,
uses a shared scale and paw baseline, creates premultiplied intermediate frames,
composites the room, circular path and hearts, and encodes with ffmpeg.
Requirements: Pillow, numpy, opencv-python-headless, ffmpeg.

From the repository root:

```sh
python scripts/build-marley-cartoon.py assets/figurer/marley-cartoon/sources/wag.webp assets/figurer/marley-cartoon/wag.mp4 --loop --duration 3
python scripts/build-marley-cartoon.py assets/figurer/marley-cartoon/sources/run.webp assets/figurer/marley-cartoon/run.mp4 --loop --circle --duration 3.2
python scripts/build-marley-cartoon.py assets/figurer/marley-cartoon/sources/eat.webp assets/figurer/marley-cartoon/eat.mp4 --hearts --duration 4.2
python scripts/build-marley-cartoon.py assets/figurer/marley-cartoon/sources/bed.webp assets/figurer/marley-cartoon/bed.mp4 --duration 4.2
python scripts/build-marley-cartoon.py assets/figurer/marley-cartoon/sources/bed.webp assets/figurer/marley-cartoon/sleep.mp4 --loop --start 18 --duration 3.6
python scripts/build-marley-cartoon.py assets/figurer/marley-cartoon/sources/smile.webp assets/figurer/marley-cartoon/smile.mp4 --columns 4 --rows 4 --duration 2.5
node scripts/test-marley-cartoon.cjs
```

The controller switches two native videos only once the next video has a decoded
frame, preserving the previous visible film during a load. Completion is driven
by the media `ended` event; basket transitions to sleep, other one-shot actions
return to wagging. Pause freezes the video's own clock. A reward during chewing
is queued until chewing finishes. Load failures retain the current visible film.

Coins, purchases and local storage keys are unchanged. Caps, glasses and toys
use the fitted wardrobe layer. The bee vest and wings are painted into all six
complete-character performances in `assets/figurer/marley-cartoon/bee/`.
Choosing or removing the bee costume switches between the dressed and plain
films at the current playback time, preserving pauses, idle rests and queued
chewing rewards. There is no bee SVG overlay.

The five dressed source sheets are retained in `bee/sources/`. Rebuild using
the commands above with `bee/` inserted before each source and output path.
For the dressed smile sheet add `--grid-cells`: neighbouring fur tips touch,
so the authored 4 × 4 grid separates the whole drawings for interpolation.
