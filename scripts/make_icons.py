"""Generate the Forja PWA icons: a champagne-gold barbell on black. Run:  python scripts/make_icons.py"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

GOLD_STOPS = [(0.0, (201, 165, 92)), (0.5, (201, 165, 92)), (1.0, (201, 165, 92))]


def gold_at(t: float) -> tuple[int, int, int, int]:
    for (a, ca), (b, cb) in zip(GOLD_STOPS, GOLD_STOPS[1:]):
        if a <= t <= b:
            k = (t - a) / (b - a)
            return (*(round(x + (y - x) * k) for x, y in zip(ca, cb)), 255)
    return (*GOLD_STOPS[-1][1], 255)


def gradient(s: int) -> Image.Image:
    g = Image.new("RGBA", (s, s))
    px = g.load()
    for y in range(s):
        for x in range(s):
            px[x, y] = gold_at((x + y) / (2 * s))
    return g


def draw_icon(size: int, maskable: bool = False) -> Image.Image:
    sc = 4
    s = size * sc
    img = Image.new("RGBA", (s, s), (0, 0, 0, 255))
    mask = Image.new("L", (s, s), 0)
    d = ImageDraw.Draw(mask)
    u = s / 64 * (0.78 if maskable else 1.0)
    o = (s - 64 * u) / 2

    def rect(x, y, w, h, r, fill=255):
        d.rounded_rectangle([o + x * u, o + y * u, o + (x + w) * u, o + (y + h) * u], radius=r * u, fill=fill)

    rect(10, 29.5, 44, 5, 1.5)
    rect(15, 19, 6, 26, 2)
    rect(43, 19, 6, 26, 2)
    rect(22.5, 23, 4, 18, 1.5, 180)
    rect(37.5, 23, 4, 18, 1.5, 180)
    img.paste(gradient(s), (0, 0), mask)
    return img.resize((size, size), Image.LANCZOS)


for size, name, mask in [
    (192, "icon-192.png", False),
    (512, "icon-512.png", False),
    (512, "icon-512-maskable.png", True),
    (180, "apple-touch-icon.png", False),
]:
    draw_icon(size, mask).convert("RGB").save(OUT / name)

(OUT / "icon.svg").write_text(
    """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9a55c"/><stop offset=".5" stop-color="#c9a55c"/><stop offset="1" stop-color="#c9a55c"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="#000"/><rect x="10" y="29.5" width="44" height="5" rx="1.5" fill="url(#g)"/><rect x="15" y="19" width="6" height="26" rx="2" fill="url(#g)"/><rect x="43" y="19" width="6" height="26" rx="2" fill="url(#g)"/><rect x="22.5" y="23" width="4" height="18" rx="1.5" fill="url(#g)" opacity=".7"/><rect x="37.5" y="23" width="4" height="18" rx="1.5" fill="url(#g)" opacity=".7"/></svg>""",
    encoding="utf-8",
)
print("icons written to", OUT)
