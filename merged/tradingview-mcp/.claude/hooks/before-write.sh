#!/bin/bash
# Before write — lock mode + Pine hints (MCP workspace layout)

FILE_PATH="$1"
FILE_CONTENT="$2"

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

LOCK_STATE="unlocked"
if [ -f "$PROJECT_ROOT/.claude/.lock_state" ]; then
  LOCK_STATE=$(cat "$PROJECT_ROOT/.claude/.lock_state")
fi

is_user_pine_area() {
  local rel="$1"
  if [[ "$rel" == projects/* ]]; then
    return 0
  fi
  if [[ "$rel" == *.pine ]] && [[ "$rel" != */* ]]; then
    return 0
  fi
  if [[ "$rel" == scripts/*.pine ]]; then
    return 0
  fi
  return 1
}

if [ "$LOCK_STATE" = "locked" ]; then
  RELATIVE_PATH="${FILE_PATH#$PROJECT_ROOT/}"
  RELATIVE_PATH="${RELATIVE_PATH//\\//}"

  if is_user_pine_area "$RELATIVE_PATH"; then
    :
  elif [[ "$RELATIVE_PATH" == .claude/.lock_state ]] ||
    [[ "$RELATIVE_PATH" == .claude/.onboarding_complete ]] ||
    [[ "$RELATIVE_PATH" == .claude/.state.json ]] ||
    [[ "$RELATIVE_PATH" == .claude/.last_session ]]; then
    :
  else
    echo "🔒 SYSTEM LOCKED: Only user Pine areas and state files are writable."
    echo "   Attempted: $RELATIVE_PATH"
    echo "   Allowed: *.pine at repo root, projects/*.pine, scripts/*.pine, .claude state files"
    echo "   Use unlock to disable protection."
    exit 1
  fi
else
  RELATIVE_PATH="${FILE_PATH#$PROJECT_ROOT/}"
  RELATIVE_PATH="${RELATIVE_PATH//\\//}"
  if [[ "$RELATIVE_PATH" == .claude/hooks/* ]] || [[ "$RELATIVE_PATH" == .claude/skills/* ]]; then
    echo "⚠️  Warning: Modifying: $RELATIVE_PATH"
  fi
fi

if [[ "$FILE_PATH" == *.pine ]]; then
  echo "📝 Pine Script write"
  REL="${FILE_PATH#$PROJECT_ROOT/}"
  REL="${REL//\\//}"
  if [[ "$REL" == projects/* ]] || [[ "$REL" == scripts/* ]] || [[ "$REL" =~ ^[^/]+\.pine$ ]]; then
    :
  else
    echo "💡 Tip: Prefer repo-root *.pine, projects/, or scripts/*.pine"
  fi
  if ! echo "$FILE_CONTENT" | head -1 | grep -q "^//@version="; then
    echo "⚠️  Warning: Pine should start with //@version=6 (or current major)"
  fi
  echo "✅ Pine write check done"
fi

if [ "$LOCK_STATE" = "locked" ]; then
  echo "🔒 Locked (user Pine areas only)"
else
  echo "🔓 Unlocked"
fi

exit 0
