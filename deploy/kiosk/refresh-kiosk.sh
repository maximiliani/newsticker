#!/bin/bash
# Sends F5 to the running Chromium kiosk window to silently reload the page.
# Invoked by chromium-kiosk-refresh.timer every 5 minutes.
set -euo pipefail

export DISPLAY="${DISPLAY:-:0}"
export XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"

if ! command -v xdotool >/dev/null 2>&1; then
  echo "xdotool not found; cannot refresh kiosk."
  exit 1
fi

# Find the Chromium window. Try both known binary names.
WID="$(xdotool search --onlyvisible --class "chromium" 2>/dev/null | head -n1 || true)"
if [[ -z "${WID}" ]]; then
  WID="$(xdotool search --onlyvisible --class "Chromium" 2>/dev/null | head -n1 || true)"
fi

if [[ -z "${WID}" ]]; then
  echo "No visible Chromium window found; skipping refresh."
  exit 0
fi

xdotool key --window "${WID}" F5

