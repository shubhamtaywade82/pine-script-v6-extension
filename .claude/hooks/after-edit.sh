#!/bin/bash
# After edit — Pine quality hints (doc paths = vendored copy)

FILE_PATH="$1"
DOC="vendor/pinescript-agents/docs/pinescript-v6/quick-reference/syntax-basics.md"

if [[ "$FILE_PATH" == *.pine ]]; then
  echo "🔍 Pine Script validation"

  if [ -f "$FILE_PATH" ]; then
    FILE_CONTENT=$(cat "$FILE_PATH")

    if echo "$FILE_CONTENT" | grep -q "security.*lookahead"; then
      if ! echo "$FILE_CONTENT" | grep -q "lookahead.*=.*barmerge\.lookahead_off"; then
        echo "⚠️ Possible repainting: security() without lookahead_off"
      fi
    fi

    if echo "$FILE_CONTENT" | grep -q "\[.*\]"; then
      if ! echo "$FILE_CONTENT" | grep -q "na("; then
        echo "💡 Tip: Check na() when using historical references []"
      fi
    fi

    if echo "$FILE_CONTENT" | grep -q "^strategy("; then
      if ! echo "$FILE_CONTENT" | grep -q "strategy\.risk"; then
        echo "💡 Tip: Consider strategy.risk* for risk management"
      fi
    fi

    if echo "$FILE_CONTENT" | grep -q "input\." && ! echo "$FILE_CONTENT" | grep -q "group="; then
      echo "💡 Tip: Group inputs with group= for clearer UI"
    fi

    LINE_NUM=0
    PREV_LINE=""
    PREV_INDENT=0
    while IFS= read -r LINE; do
      LINE_NUM=$((LINE_NUM + 1))
      STRIPPED="${LINE#"${LINE%%[![:space:]]*}"}"
      CURR_INDENT=$((${#LINE} - ${#STRIPPED}))

      if echo "$PREV_LINE" | grep -qE '[^"'\'':]:[[:space:]]*$|[^"'\''?]\?[[:space:]]*$'; then
        if [ "$CURR_INDENT" -le "$PREV_INDENT" ] && [ -n "$STRIPPED" ]; then
          echo "⚠️ Line $LINE_NUM: possible line continuation / ternary wrap issue"
          echo "   See: $DOC"
        fi
      fi

      PREV_LINE="$LINE"
      PREV_INDENT="$CURR_INDENT"
    done <"$FILE_PATH"

    echo "✅ Pine validation complete"
  fi
fi

exit 0
