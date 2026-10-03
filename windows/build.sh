#!/bin/bash
# Byg Taktiktavle.exe til Windows (Godot 4.7, samme som MG Games-launcheren): programmet åbner appen i Edge/Chrome i
# app-tilstand og venter, til vinduet lukkes. Logikken afprøves på Macen med Chrome (se README); selve .exe'en kan ikke
# køres her. Brug: windows/build.sh  →  windows/build/Taktiktavle.exe
set -e
cd "$(dirname "$0")"
G="${GODOT:-/Users/mortengam/PixelMonstersFP/_godot/Godot.app/Contents/MacOS/Godot}"
rm -rf build && mkdir -p build
"$G" --headless --path . --import >/dev/null 2>&1
"$G" --headless --path . --export-release "Windows Desktop" build/Taktiktavle.exe > build/export.log 2>&1 || { tail -20 build/export.log; exit 1; }
echo "eksport: ERROR-linjer $(grep -c '^ERROR' build/export.log || true), WARNING-linjer $(grep -c 'WARNING' build/export.log || true)"
file build/Taktiktavle.exe | sed 's#^build/##'
echo "størrelse: $(du -h build/Taktiktavle.exe | cut -f1)"
