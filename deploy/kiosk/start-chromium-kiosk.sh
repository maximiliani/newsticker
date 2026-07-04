#!/bin/bash
set -euo pipefail

URL="${NEWSTICKER_KIOSK_URL:-http://localhost:3000}"
DISPLAY="${DISPLAY:-:0}"
XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"

export DISPLAY
export XAUTHORITY

# Wait until X11 socket exists.
for _ in $(seq 1 60); do
  if [[ -S "/tmp/.X11-unix/X${DISPLAY#:}" ]]; then
    break
  fi
  sleep 1
done

# Hide cursor when idle if available.
if command -v unclutter >/dev/null 2>&1; then
  unclutter -idle 0.5 -root >/dev/null 2>&1 &
fi

CHROMIUM_BIN=""
if command -v chromium >/dev/null 2>&1; then
  CHROMIUM_BIN="$(command -v chromium)"
elif command -v chromium-browser >/dev/null 2>&1; then
  CHROMIUM_BIN="$(command -v chromium-browser)"
else
  echo "Chromium binary not found (chromium/chromium-browser)."
  exit 1
fi

exec "${CHROMIUM_BIN}" \
  --kiosk \
  --app="${URL}" \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=TranslateUI \
  --enable-features=WebHID \
  --autoplay-policy=no-user-gesture-required \
  --check-for-update-interval=31536000

