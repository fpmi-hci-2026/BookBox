#!/bin/bash
# Рендер SVG → PNG через headless Chrome (2x для retina-качества).
# Использование: scripts/diagrams/render.sh
set -euo pipefail

DIR="$(cd "$(dirname "$0")/../../docs/images/lab2" && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [ ! -x "$CHROME" ]; then
  echo "Google Chrome не найден: $CHROME" >&2
  exit 1
fi

for svg in "$DIR"/*.svg; do
  name="$(basename "$svg" .svg)"
  # размеры берём из самого SVG
  w=$(sed -n 's/.*width="\([0-9]*\)".*/\1/p' "$svg" | head -1)
  h=$(sed -n 's/.*height="\([0-9]*\)".*/\1/p' "$svg" | head -1)

  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --force-device-scale-factor=2 \
    --window-size="${w},${h}" \
    --screenshot="$DIR/$name.png" \
    "file://$svg" >/dev/null 2>&1

  echo "$name.png: ${w}x${h} (2x)"
done
