#!/bin/bash
# Byg Taktiktavle.app (universal: Apple silicon og Intel, macOS 12+), ad hoc-signeret som spillene i MG Games-launcheren.
# Brug: mac/build.sh [version] [build]   →  mac/build/Taktiktavle.app
set -e
cd "$(dirname "$0")"
VER="${1:-1.0}"; BUILD="${2:-1}"
OUT=build; APP="$OUT/Taktiktavle.app"
rm -rf "$OUT"; mkdir -p "$OUT/obj" "$APP/Contents/MacOS" "$APP/Contents/Resources"
for arch in arm64 x86_64; do
	xcrun swiftc -O -swift-version 5 -target "$arch-apple-macos12.0" -framework AppKit -framework WebKit \
		-o "$OUT/obj/Taktiktavle-$arch" Taktiktavle.swift
done
lipo -create "$OUT/obj/Taktiktavle-arm64" "$OUT/obj/Taktiktavle-x86_64" -output "$APP/Contents/MacOS/Taktiktavle"
sed -e "s/__VERSION__/$VER/" -e "s/__BUILD__/$BUILD/" Info.plist > "$APP/Contents/Info.plist"
printf 'APPL????' > "$APP/Contents/PkgInfo"
python3 make_icon.py "$OUT/ikon" >/dev/null && cp "$OUT/ikon/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict "$APP" && echo "signatur: gyldig (ad hoc)"
echo "arkitekturer: $(lipo -archs "$APP/Contents/MacOS/Taktiktavle")  version $VER ($BUILD)  $(du -sh "$APP" | cut -f1)"
