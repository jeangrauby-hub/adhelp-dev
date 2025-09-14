#!/usr/bin/env bash
set -euo pipefail
LOG_DIR="$HOME/Library/Logs/adhelp"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/start_$(date +"%Y-%m-%d_%Hh%Mm%Ss").log"
{
  cd "$(dirname "$0")"
  if [ -s "/opt/homebrew/opt/nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    . "/opt/homebrew/opt/nvm/nvm.sh"
    nvm use --lts >/dev/null || true
  fi
  if [ ! -d "node_modules" ] && [ -f "package.json" ]; then
    echo "Installing deps…"
    npm install
  fi
  echo "Starting dev server…"
  npm run dev
} >>"$LOG_FILE" 2>&1 || osascript -e "display notification \"Erreur dans start.sh\" with title \"ADHELP\""
