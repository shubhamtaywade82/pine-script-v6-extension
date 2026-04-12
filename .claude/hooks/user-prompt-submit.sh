#!/bin/bash
# User prompt submit — routing hints (TradersPost) + TradingView MCP workspace

PROMPT="$1"
PROMPT_LOWER=$(echo "$PROMPT" | tr "[:upper:]" "[:lower:]")

if [[ "$PROMPT_LOWER" == "lock" ]]; then
  echo "locked" >.claude/.lock_state
  echo "🔒 LOCKED — only user Pine areas (repo *.pine, projects/, scripts/*.pine) + state files"
  echo "Protected: vendor/pinescript-agents/docs, src/, package manifests, top-level docs"
  echo "Use unlock to disable."
  exit 0
fi

if [[ "$PROMPT_LOWER" == "unlock" ]]; then
  echo "unlocked" >.claude/.lock_state
  echo "🔓 UNLOCKED — full repo writable (use with care)"
  exit 0
fi

count_workspace_pines() {
  local root=0
  local proj=0
  root=$(find . -maxdepth 1 -name "*.pine" 2>/dev/null | wc -l | tr -d " ")
  if [ -d "./projects" ]; then
    proj=$(ls -1 ./projects/*.pine 2>/dev/null | grep -v blank.pine | wc -l | tr -d " ")
  fi
  echo $((root + proj))
}

if [[ "$PROMPT_LOWER" == "status" ]]; then
  if [ -f ".claude/.lock_state" ]; then
    STATE=$(cat ".claude/.lock_state")
  else
    STATE="unlocked"
  fi
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔐 Lock: $(echo "$STATE" | tr "[:lower:]" "[:upper:]")"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  PC=$(count_workspace_pines)
  echo "📁 Workspace .pine files: $PC"
  echo ""
  echo "🎯 Skills under .claude/skills/ (auto-activated by request):"
  for skill_dir in .claude/skills/*/; do
    if [ -f "${skill_dir}SKILL.md" ]; then
      echo "   • $(basename "$skill_dir")"
    fi
  done
  exit 0
fi

if [[ "$PROMPT_LOWER" == "start" ]]; then
  echo "🚀 TradingView MCP + TradersPost Pine agents"
  echo ""
  echo "• Pine skills: .claude/skills/ (same behaviors as github.com/TradersPost/pinescript-agents)"
  echo "• Docs: vendor/pinescript-agents/docs/"
  echo "• Live chart: connect MCP + TradingView Desktop (README + CLAUDE.md)"
  echo "• Refresh vendored docs: npm run sync:pinescript-agents"
  exit 0
fi

if [[ "$PROMPT_LOWER" == "help" ]]; then
  echo "📚 Commands:"
  echo "  start — workspace overview (MCP + agents)"
  echo "  help — this list"
  echo "  status — lock state, .pine count, skills"
  echo "  lock / unlock — restrict writes to user Pine areas"
  echo ""
  echo "🎯 Skills: pine-visualizer, pine-developer, pine-debugger, pine-backtester,"
  echo "           pine-optimizer, pine-manager, pine-publisher, tradingview-mcp-pine"
  echo ""
  echo "Upstream: https://github.com/TradersPost/pinescript-agents"
  exit 0
fi

if [[ "$PROMPT_LOWER" == "examples" ]]; then
  if [ -d "examples" ]; then
    echo "📁 examples/:"
    ls -1 examples/*/*.pine 2>/dev/null | sed "s|^|  |"
  else
    echo "No examples/ in this repo. See upstream:"
    echo "  https://github.com/TradersPost/pinescript-agents/tree/main/examples"
  fi
  exit 0
fi

if [[ "$PROMPT_LOWER" == "templates" ]]; then
  echo "Templates live in the upstream repo (templates/). Describe what you want"
  echo "or open: https://github.com/TradersPost/pinescript-agents"
  exit 0
fi

show_skill_info() {
  echo "🎯 $1 → $2"
  echo "---"
}

if [[ "$PROMPT_LOWER" == *"create"* ]] || [[ "$PROMPT_LOWER" == *"build"* ]] || [[ "$PROMPT_LOWER" == *"make"* ]] || [[ "$PROMPT_LOWER" == *"new"* ]]; then
  if [[ "$PROMPT_LOWER" == *"indicator"* ]] || [[ "$PROMPT_LOWER" == *"strategy"* ]] || [[ "$PROMPT_LOWER" == *"script"* ]]; then
    show_skill_info "New Pine work" "pine-manager / pine-developer"
  fi
fi

if [[ "$PROMPT_LOWER" == *"debug"* ]] || [[ "$PROMPT_LOWER" == *"error"* ]] || [[ "$PROMPT_LOWER" == *"fix"* ]] || [[ "$PROMPT_LOWER" == *"issue"* ]] || [[ "$PROMPT_LOWER" == *"problem"* ]]; then
  show_skill_info "Debugging" "pine-debugger (+ tradingview-mcp-pine for compile errors)"
fi

if [[ "$PROMPT_LOWER" == *"optimize"* ]] || [[ "$PROMPT_LOWER" == *"faster"* ]] || [[ "$PROMPT_LOWER" == *"improve"* ]]; then
  show_skill_info "Optimization / UX" "pine-optimizer"
fi

if [[ "$PROMPT_LOWER" == *"backtest"* ]] || [[ "$PROMPT_LOWER" == *"metrics"* ]]; then
  if [[ "$PROMPT_LOWER" == *"strategy"* ]] || [[ "$PROMPT_LOWER" == *"win"* ]]; then
    show_skill_info "Backtesting" "pine-backtester"
  fi
fi

if [[ "$PROMPT_LOWER" == *"publish"* ]] || [[ "$PROMPT_LOWER" == *"release"* ]]; then
  show_skill_info "Publication" "pine-publisher"
fi

if [[ "$PROMPT_LOWER" == *"youtube.com"* ]] || [[ "$PROMPT_LOWER" == *"youtu.be"* ]]; then
  show_skill_info "Video / concept extraction" "pine-visualizer"
fi

COMPLEXITY_SCORE=0
[[ "$PROMPT_LOWER" == *"and"* ]] && COMPLEXITY_SCORE=$((COMPLEXITY_SCORE + 1))
[[ "$PROMPT_LOWER" == *"with"* ]] && COMPLEXITY_SCORE=$((COMPLEXITY_SCORE + 1))
[[ "$PROMPT_LOWER" == *"also"* ]] && COMPLEXITY_SCORE=$((COMPLEXITY_SCORE + 1))
[[ "$PROMPT_LOWER" == *"multi"* ]] && COMPLEXITY_SCORE=$((COMPLEXITY_SCORE + 1))
[[ "$PROMPT_LOWER" == *"complete"* ]] && COMPLEXITY_SCORE=$((COMPLEXITY_SCORE + 1))
[[ "$PROMPT_LOWER" == *"full"* ]] && COMPLEXITY_SCORE=$((COMPLEXITY_SCORE + 1))

if [ "$COMPLEXITY_SCORE" -ge 2 ]; then
  show_skill_info "Complex build" "pine-manager"
fi

exit 0
