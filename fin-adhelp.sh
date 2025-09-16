#!/bin/zsh
set -e

# Aller dans le dossier du projet (où est docker-compose.yml)
cd /Users/jean/projet || exit 1

echo "== ADHELP :: FIN =="

# 1) Sauvegarde DB (dump SQL horodaté)
TS=$(date +"%Y-%m-%d_%Hh%Mm%Ss")
BACKUP_DIR="backups/$TS"
mkdir -p "$BACKUP_DIR"

echo "💾 pg_dump → $BACKUP_DIR/db_dump.sql"
docker compose exec -T db pg_dump -U adhelp adhelp > "$BACKUP_DIR/db_dump.sql" || {
  echo "⚠️  Échec pg_dump (peut-être DB arrêtée trop tôt)"
}

# 2) Archive ZIP
echo "📦 archive → ${BACKUP_DIR}.zip"
zip -r "${BACKUP_DIR}.zip" "$BACKUP_DIR" > /dev/null

# 3) Arrêt des conteneurs
echo "🛑 docker compose down"
docker compose down

# 4) Stabilisation
echo "⏳ Stabilisation post-down (6s)…"
sleep 6

# 5) Vérification conteneurs (info debug uniquement)
if docker info >/dev/null 2>&1; then
  containers_left=$(docker ps -q 2>/dev/null || true)
  if [ -n "$containers_left" ]; then
    echo "ℹ️ Des conteneurs tiers sont encore actifs."
  else
    echo "✅ Plus de conteneurs du projet."
  fi
else
  echo "ℹ️ Daemon Docker semble déjà arrêté."
fi

# 6) Alerte macOS finale
echo "✅ Sauvegarde terminée → ${BACKUP_DIR}.zip"
osascript <<EOF
display alert "ADHELP" message "✅ Sauvegarde terminée → ${BACKUP_DIR}.zip

⚠️ EN GROS : Pense à FERMER manuellement l'application Docker Desktop (icône baleine 🐳 en haut à droite) si tu n'en as plus besoin !" as critical buttons {"OK"} default button "OK"
EOF

exit 0