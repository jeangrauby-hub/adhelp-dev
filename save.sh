#!/usr/bin/env bash
set -euo pipefail
LOG_DIR="$HOME/Library/Logs/adhelp"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/save_$(date +"%Y-%m-%d_%Hh%Mm%Ss").log"
{
  MSG="${1:-sauvegarde auto}"
  PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
  cd "$PROJECT_ROOT"
  STAMP="$(date +"%Y-%m-%d_%Hh%Mm%Ss")"
  git add -A
  if git diff --cached --quiet; then
    echo "Rien à committer."
  else
    git commit -m "save(${STAMP}): ${MSG}" || true
  fi
  git tag -f last-save >/dev/null 2>&1 || true
  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD || echo main)"
  git push -u origin "${CURRENT_BRANCH}" --tags
  SAVE_DIR="${PROJECT_ROOT}/save"
  mkdir -p "${SAVE_DIR}"
  ZIP_PATH="${SAVE_DIR}/backup_${STAMP}.zip"
  zip -r "${ZIP_PATH}" "${PROJECT_ROOT}" \
    -x "*/.git/*" "*/save/*" "*/node_modules/*" "*/.DS_Store" "*.zip" >/dev/null
  echo "OK: ${ZIP_PATH}"
} >>"$LOG_FILE" 2>&1 || osascript -e "display notification \"Erreur dans save.sh\" with title \"ADHELP\""
