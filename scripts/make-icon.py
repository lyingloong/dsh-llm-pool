#!/usr/bin/env python3
"""Generate docs/assets/icon.png (original artwork for this repository).

Requires Pillow. The SVG in the same directory is the scalable source; this
script renders the same composition as a 512x512 PNG for GitHub/npm previews.
"""

from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 512
SCALE = 4
S = SIZE * SCALE
OUT = Path(__file__).resolve().parent.parent / "docs" / "assets" / "icon.png"

BACKGROUND = (15, 23, 42, 255)
BORDER = (51, 65, 85, 255)
LINE = (148, 163, 184, 255)
RING = (226, 232, 240, 255)
NODES = [
    (160, 160, (59, 130, 246, 255)),
    (352, 160, (20, 184, 166, 255)),
    (256, 360, (245, 158, 11, 255)),
]
CENTER = (256, 250)
NODE_RADIUS = 54
RING_RADIUS = 38
LINE_WIDTH = 14


def scaled(value):
    return int(round(value * SCALE))


def main():
    image = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        [0, 0, S - 1, S - 1],
        radius=scaled(112),
        fill=BACKGROUND,
        outline=BORDER,
        width=scaled(8),
    )
    for x, y, _ in NODES:
        draw.line(
            [scaled(x), scaled(y), scaled(CENTER[0]), scaled(CENTER[1])],
            fill=LINE,
            width=scaled(LINE_WIDTH),
        )
    draw.ellipse(
        [
            scaled(CENTER[0] - RING_RADIUS),
            scaled(CENTER[1] - RING_RADIUS),
            scaled(CENTER[0] + RING_RADIUS),
            scaled(CENTER[1] + RING_RADIUS),
        ],
        fill=BACKGROUND,
        outline=RING,
        width=scaled(16),
    )
    for x, y, color in NODES:
        draw.ellipse(
            [
                scaled(x - NODE_RADIUS),
                scaled(y - NODE_RADIUS),
                scaled(x + NODE_RADIUS),
                scaled(y + NODE_RADIUS),
            ],
            fill=color,
        )
    image = image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
