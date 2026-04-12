#!/bin/bash
# Before delete — lock mode (MCP workspace)

FILE_PATH="$1"
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

LOCK_STATE="unlocked"
if [ -f "$PROJECT_ROOT/.claude/.lock_state" ]; then
  LOCK_STATE=$(cat "$PROJECT_ROOT/.claude/.lock_state")
fi

is_user_pine_path() {
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

  if is_user_pine_path "$RELATIVE_PATH"; then
    echo "✅ Deleting user file: $RELATIVE_PATH"
  else
    echo "🔒 SYSTEM LOCKED: Cannot delete outside user Pine areas."
    echo "   Attempted: $RELATIVE_PATH"
    echo "   Use unlock to allow broader changes."
    exit 1
  fi
else
  RELATIVE_PATH="${FILE_PATH#$PROJECT_ROOT/}"
  RELATIVE_PATH="${RELATIVE_PATH//\\//}"
  if [[ "$RELATIVE_PATH" == vendor/pinescript-agents/* ]] ||
    [[ "$RELATIVE_PATH" == .claude/hooks/* ]] ||
    [[ "$RELATIVE_PATH" == .claude/skills/* ]]; then
    echo "⚠️  Warning: Deleting: $RELATIVE_PATH"
  fi
  echo "🔓 Unlocked — deletion allowed"
fi

exit 0
