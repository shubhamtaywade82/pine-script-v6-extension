#!/bin/bash
# Startup hook — TradersPost pine agents + TradingView MCP workspace

echo "🚀 TradingView MCP + Pine Script agents initializing..."
echo "=================================================="
echo ""

ONBOARDING_FILE=".claude/.onboarding_complete"

if [ ! -f "$ONBOARDING_FILE" ]; then
  echo "👋 Welcome! This repo combines:"
  echo "   • TradersPost Pine skills (see .claude/skills/)"
  echo "   • Bundled docs: vendor/pinescript-agents/docs/"
  echo "   • TradingView Desktop control via MCP (see repo CLAUDE.md)"
  echo ""
  echo "📋 CHECKLIST:"
  echo "✓ Pine skills loaded (orchestrator + developer + debugger + …)"
  echo "✓ Pine v6 docs vendored for offline use"
  echo "✓ Connect MCP to TradingView with remote debugging (see README)"
  echo ""
  echo "🎯 NEXT STEPS:"
  echo "  1. Describe what to build (indicator/strategy) — skills activate automatically"
  echo "  2. Save scripts as *.pine in the repo root or under projects/"
  echo "  3. With MCP: use pine_set_source / pine_smart_compile / pine_get_errors"
  echo ""

  touch "$ONBOARDING_FILE"

  echo "{
  \"onboarded\": true,
  \"first_run\": \"$(date -u +\"%Y-%m-%dT%H:%M:%SZ\")\",
  \"bundle\": \"tradingview-mcp+pinescript-agents\"
}" >.claude/.state.json

else
  echo "✅ Pine agents + TradingView MCP ready"
  echo ""

  PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
  ROOT_COUNT=$(find "$PROJECT_ROOT" -maxdepth 1 -name "*.pine" 2>/dev/null | wc -l | tr -d " ")
  if [ -d "$PROJECT_ROOT/projects" ]; then
    PROJ_COUNT=$(ls -1 "$PROJECT_ROOT/projects/"*.pine 2>/dev/null | grep -v blank.pine | wc -l | tr -d " ")
  else
    PROJ_COUNT=0
  fi
  TOTAL=$((ROOT_COUNT + PROJ_COUNT))

  if [ "$TOTAL" -gt 0 ]; then
    echo "📁 Pine scripts in workspace: $TOTAL"
    find "$PROJECT_ROOT" -maxdepth 1 -name "*.pine" 2>/dev/null | head -5 | sed "s|$PROJECT_ROOT/|  - |"
    if [ -d "$PROJECT_ROOT/projects" ]; then
      ls -1 "$PROJECT_ROOT/projects/"*.pine 2>/dev/null | grep -v blank.pine | head -5 | sed "s|$PROJECT_ROOT/|  - |"
    fi
    echo ""
  fi

  echo "💡 Quick actions:"
  echo "  • Build: natural language (pine-developer / pine-manager)"
  echo "  • Live chart: MCP tools in CLAUDE.md"
  echo "  • Refresh upstream docs: npm run sync:pinescript-agents"
  echo ""
fi

exit 0
