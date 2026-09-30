#!/usr/bin/env python3
"""Tegner appens ikoner (PNG) til docs/icons/. Kør: python3 tools/make_icons.py"""
import math
import pathlib
from PIL import Image, ImageDraw

OUT = pathlib.Path(__file__).resolve().parent.parent / "docs" / "icons"
SS = 4  # supersampling for bløde kanter

STRIPE_A = (47, 122, 61)
STRIPE_B = (42, 110, 55)
WHITE = (255, 255, 255)
CONE = (255, 143, 77)


def icon(size: int, content_scale: float) -> Image.Image:
    S = size * SS
    img = Image.new("RGB", (S, S), STRIPE_A)
    d = ImageDraw.Draw(img)
    bands = 7
    for i in range(bands):
        if i % 2:
            d.rectangle([0, i * S / bands, S, (i + 1) * S / bands], fill=STRIPE_B)

    # Alt indhold tegnes i en 100x100-koordinat, skaleret om midten
    k = S / 100 * content_scale
    off = (S - 100 * k) / 2

    def P(x, y):
        return (off + x * k, off + y * k)

    lw = max(2, round(3.2 * k))
    x0, y0, x1, y1 = 24, 14, 76, 86
    d.rectangle([*P(x0, y0), *P(x1, y1)], outline=WHITE, width=lw)
    d.line([*P(x0, 50), *P(x1, 50)], fill=WHITE, width=lw)
    d.rectangle([*P(38, 14), *P(62, 25)], outline=WHITE, width=lw)
    d.rectangle([*P(38, 75), *P(62, 86)], outline=WHITE, width=lw)

    # Stiplet afleveringspil fra orange spiller til hvid spiller
    ax, ay = 37, 67
    bx, by = 63, 33
    length = math.hypot(bx - ax, by - ay)
    ux, uy = (bx - ax) / length, (by - ay) / length
    t, dash, gap = 7.0, 4.2, 3.2
    end = length - 12
    while t < end:
        t2 = min(t + dash, end)
        d.line([*P(ax + ux * t, ay + uy * t), *P(ax + ux * t2, ay + uy * t2)], fill=WHITE, width=lw)
        t = t2 + gap
    tip = (ax + ux * (length - 8.5), ay + uy * (length - 8.5))
    nx, ny = -uy, ux
    base = (tip[0] - ux * 6.5, tip[1] - uy * 6.5)
    d.polygon([P(*tip), P(base[0] + nx * 4, base[1] + ny * 4), P(base[0] - nx * 4, base[1] - ny * 4)], fill=WHITE)

    def disc(x, y, rr, fill, ring):
        px, py = P(x, y)
        R = rr * k
        d.ellipse([px - R, py - R, px + R, py + R], fill=fill, outline=ring, width=max(2, round(2.2 * k)))

    disc(ax, ay, 8, CONE, WHITE)
    disc(bx, by, 8, WHITE, (22, 60, 34))
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    icon(192, 1.0).save(OUT / "icon-192.png")
    icon(512, 1.0).save(OUT / "icon-512.png")
    icon(180, 1.0).save(OUT / "apple-touch-icon.png")
    icon(512, 0.78).save(OUT / "maskable-512.png")  # indhold inden for sikker zone
    for p in sorted(OUT.iterdir()):
        print(p.name, Image.open(p).size)


if __name__ == "__main__":
    main()
