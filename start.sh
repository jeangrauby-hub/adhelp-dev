#!/usr/bin/env bash
set -euo pipefail

# Assure un PATH complet même lancé depuis Automator
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

LOG_DIR="$HOME/Library/Logs/adhelp"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/start_$(date +"%Y-%m-%d_%Hh%Mm%Ss").log"

{
  cd "$(dirname "$0")"

  # Charge nvm si présent (facultatif)
  if [ -s "/opt/homebrew/opt/nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    . "/opt/homebrew/opt/nvm/nvm.sh"
    nvm use --lts >/dev/null || true
  fi

  # Installe les deps si absentes
  if [ ! -d "node_modules" ] && [ -f "package.json" ]; then
    echo "Installing deps…"
    npm install
  fi

  echo "Starting dev server…"
  npm run dev
} >>"$LOG_FILE" 2>&1 || osascript -e "display notification \"Erreur dans start.sh (voir logs)\" with title \"ADHELP\""
