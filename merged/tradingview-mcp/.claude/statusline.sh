#!/bin/bash
# PineScript agents + TradingView MCP — statusline (adapted from TradersPost/pinescript-agents)

input=$(cat)

PROJECT_DIR=$(echo "$input" | jq -r '.workspace.project_dir // ""')

STATUS_FILE="$PROJECT_DIR/.claude/.video_status"
if [ -f "$STATUS_FILE" ]; then
  VIDEO_STATUS=$(cat "$STATUS_FILE" 2>/dev/null)
  if [ -n "$VIDEO_STATUS" ]; then
    echo "$VIDEO_STATUS"
    exit 0
  fi
fi

VERSION="1.0.0"
if [ -f "$PROJECT_DIR/package.json" ]; then
  VERSION=$(cat "$PROJECT_DIR/package.json" | jq -r '.version // "1.0.0"')
fi

ROOT_PINES=0
if [ -n "$PROJECT_DIR" ]; then
  ROOT_PINES=$(find "$PROJECT_DIR" -maxdepth 1 -name "*.pine" 2>/dev/null | wc -l | tr -d " ")
fi

PROJECT_PINES=0
if [ -d "$PROJECT_DIR/projects" ]; then
  PROJECT_PINES=$(ls -1 "$PROJECT_DIR/projects/"*.pine 2>/dev/null | grep -v blank.pine | wc -l | tr -d " ")
fi

PINECOUNT=$((ROOT_PINES + PROJECT_PINES))

SKILL_COUNT=$(ls -1d "$PROJECT_DIR/.claude/skills/"*/ 2>/dev/null | wc -l | tr -d " ")

echo "TradingView MCP v$VERSION | Pine agents | 📜 $PINECOUNT .pine | ⚡ $SKILL_COUNT skills | TradersPost + MCP"
