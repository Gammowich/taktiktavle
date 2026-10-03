#!/usr/bin/env python3
"""Mac-ikonet (AppIcon.icns) ud fra appens ikon (tools/make_icons.py): et afrundet kvadrat med luft omkring, som macOS'
egne ikoner (824 px i 1024 px). Brug: python3 mac/make_icon.py <mappe>  →  <mappe>/AppIcon.icns og <mappe>/icon-1024.png"""
import pathlib
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "tools"))
from make_icons import icon  # noqa: E402


def mac_icon(size: int = 1024) -> Image.Image:
    art, inset = round(size * 824 / 1024), round(size * 100 / 1024)
    radius = round(art * 0.2237)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (art * 4, art * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, art * 4 - 1, art * 4 - 1], radius=radius * 4, fill=255)
    mask = mask.resize((art, art), Image.LANCZOS)
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sm = Image.new("L", (size, size), 0)
    sm.paste(mask, (inset, inset + round(size * 0.012)))
    shadow.putalpha(sm.filter(ImageFilter.GaussianBlur(size * 0.012)).point(lambda v: v * 0.45))
    canvas = Image.alpha_composite(canvas, shadow)
    tile = icon(art, 0.9).convert("RGBA")
    tile.putalpha(mask)
    canvas.alpha_composite(tile, (inset, inset))
    return canvas


def main():
    out = pathlib.Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    big = mac_icon(1024)
    big.save(out / "icon-1024.png")
    with tempfile.TemporaryDirectory() as td:
        iconset = pathlib.Path(td) / "AppIcon.iconset"
        iconset.mkdir()
        for s in (16, 32, 128, 256, 512):
            big.resize((s, s), Image.LANCZOS).save(iconset / f"icon_{s}x{s}.png")
            big.resize((s * 2, s * 2), Image.LANCZOS).save(iconset / f"icon_{s}x{s}@2x.png")
        subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(out / "AppIcon.icns")], check=True)
    print("AppIcon.icns", (out / "AppIcon.icns").stat().st_size, "byte")


if __name__ == "__main__":
    main()
