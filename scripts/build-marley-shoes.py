"""Rebuild both complete-character shoe outfits from their painted keyframes.

The images were edited with imagegen: preserve the whole character and each pose,
paint coral sneakers around every visible paw, and retain the bee costume where
present. Runtime shoes are not overlays. Run from the repository root.
"""
from pathlib import Path
import importlib.util

import cv2
import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location("marley_cartoon_builder", Path(__file__).with_name("build-marley-cartoon.py"))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
assemble = builder.assemble


def build():
    cv2.setNumThreads(2)
    for outfit in ("shoes", "bee-shoes"):
        base = Path("assets/figurer/marley-cartoon") / outfit
        for clip, source, duration, options in (
            ("wag", "wag", 3, {"loop": True}),
            ("run", "run", 3.2, {"loop": True, "circle": True}),
            ("eat", "eat", 4.2, {"hearts": True}),
            ("bed", "bed", 4.2, {}),
            ("sleep", "bed", 3.6, {"loop": True, "start": 18}),
            ("smile", "smile", 2.5, {}),
        ):
            sheet = base / "sources" / (source + ".webp")
            columns, rows = (4, 4) if source == "smile" else (6, 4)
            alpha = np.asarray(Image.open(sheet).convert("RGBA"))[:, :, 3]
            _, _, stats, _ = cv2.connectedComponentsWithStats((alpha > 30).astype("uint8"))
            separate = sum(stat[4] > 2000 for stat in stats[1:])
            assemble(sheet, base / (clip + ".mp4"), columns, rows, duration,
                     options.get("loop", False), 640, options.get("start", 0),
                     options.get("circle", False), options.get("hearts", False),
                     grid_cells=separate != columns * rows)


if __name__ == "__main__":
    build()
