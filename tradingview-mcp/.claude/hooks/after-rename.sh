#!/bin/bash
# After rename — recreate projects/blank.pine when used (optional TradersPost flow)

OLD_PATH="$1"
NEW_PATH="$2"

if [[ "$(basename "$OLD_PATH")" == "blank.pine" ]] && [[ "$OLD_PATH" == */projects/* ]]; then
  echo "🔄 Project initialized: $(basename "$NEW_PATH")"

  BLANK_TEMPLATE="//@version=6
// Blank Pine template — rename and implement
indicator(\"Blank Template\", overlay=true)"
  PROJECTS_DIR="$(dirname "$OLD_PATH")"
  echo "$BLANK_TEMPLATE" >"$PROJECTS_DIR/blank.pine"
  echo "✅ New blank.pine created under projects/"
fi

exit 0
