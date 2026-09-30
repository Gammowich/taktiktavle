#!/usr/bin/env python3
"""Bygger den installerbare webapp i pwa/ ud fra app.html.

app.html er kilden. Den er skrevet uden <html>/<head>/<body>, så den også kan
publiceres direkte som claude.ai-artifact. Dette script pakker den ind i et
fuldt dokument med manifest, ikoner og service worker (offline-brug).

Kør:  python3 build.py
"""
import hashlib
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
PWA = ROOT / "pwa"

src = (ROOT / "app.html").read_text(encoding="utf-8")

# <title>, <meta> og <link> øverst i filen flyttes op i <head>
m = re.match(r"\s*((?:(?:<title>.*?</title>|<meta\b[^>]*>|<link\b[^>]*>)\s*)+)", src, re.S)
head_tags = m.group(1).strip() if m else ""
body = src[m.end():] if m else src

version = hashlib.sha256(src.encode("utf-8")).hexdigest()[:10]

page = f"""<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#2a6936">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Taktiktavle">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}</style>
{head_tags}
</head>
<body>
{body.strip()}
</body>
</html>
"""
(PWA / "index.html").write_text(page, encoding="utf-8")

sw = (ROOT / "tools" / "sw.template.js").read_text(encoding="utf-8").replace("__VERSION__", version)
(PWA / "sw.js").write_text(sw, encoding="utf-8")

print(f"pwa/index.html  {len(page):>7} tegn")
print(f"pwa/sw.js       version {version}")
