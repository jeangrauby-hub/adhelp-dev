#!/bin/zsh
set -e

# Aller dans le dossier du projet (où est docker-compose.yml)
cd /Users/jean/projet || exit 1

# 🐳 Démarrer Docker Desktop si nécessaire (+ pause + attente prête)
if ! docker info >/dev/null 2>&1; then
  echo "🐳 Docker non démarré → lancement…"
  open -ga "Docker"
  echo "⏳ Attente du démarrage de Docker Desktop (pause 10s)…"
  sleep 10
  # Attendre jusqu’à ~90s que le daemon réponde
  for i in {1..45}; do
    if docker info >/dev/null 2>&1; then
      echo "✅ Docker prêt"
      break
    fi
    echo "  … attente Docker ($i/45)"
    sleep 2
  done
fi

# (optionnel) s’assurer du bon contexte Docker Desktop
docker context use desktop-linux >/dev/null 2>&1 || true

echo "== ADHELP :: DÉBUT =="

# 🐳 Démarrer Docker Desktop si nécessaire (+ pause contrôlée)
if ! docker info >/dev/null 2>&1; then
  echo "🐳 Docker non démarré → lancement…"
  open -ga "Docker"
  echo "⏳ Pause initiale pour Docker (10s)…"
  sleep 10
  for i in {1..30}; do
    if docker info >/dev/null 2>&1; then
      echo "✅ Docker prêt"
      break
    fi
    echo "  … attente Docker ($i/30)"
    sleep 2
  done
fi
# Contexte par défaut (silence les erreurs si déjà bon)
docker context use desktop-linux >/dev/null 2>&1 || true

# 1) Lancer les conteneurs
echo "🚀 docker compose up -d"
docker compose up -d

# 2) Attendre la DB Postgres
echo "⏳ Attente DB (pg_isready)…"
for i in {1..20}; do
  if docker compose exec -T db pg_isready -U adhelp >/dev/null 2>&1; then
    echo "✅ DB prête"
    break
  fi
  echo "  … DB pas encore prête ($i/20)"
  sleep 2
done

# 3) Migrations + seed
echo "🛠  php artisan migrate --force & db:seed"
docker compose exec -T api bash -lc 'cd /app && php artisan migrate --force || true; cd /app && php artisan db:seed --force || true'

# 4) Caches Laravel
docker compose exec -T api bash -lc 'cd /app && php artisan config:cache || true; cd /app && php artisan route:cache || true'

# 5) Attendre que l’API soit HEALTHY (healthcheck Docker)
echo "⏳ Vérification santé API…"
for i in {1..20}; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' projet-api-1 2>/dev/null || echo "starting")
  if [ "$STATUS" = "healthy" ]; then
    echo "✅ API en bonne santé"
    break
  fi
  echo "  … statut actuel = $STATUS ($i/20)"
  sleep 3
done

# 6) Info finale (alerte modale macOS)
echo "✅ Backend prêt → http://localhost:8000"
osascript -e 'display alert "ADHELP" message "Backend prêt → http://localhost:8000"'

# 7) Lancer le FRONT (live-server) s'il n'est pas déjà en écoute sur 5173
echo "🧪 Vérification front (port 5173)…"
if ! lsof -i :5173 >/dev/null 2>&1; then
  echo "▶️  Démarrage du front (npm run dev)…"
  mkdir -p /Users/jean/projet/logs
  # lance en arrière-plan, avec un PATH qui inclut Homebrew
  (
    cd /Users/jean/projet
    export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
    nohup npm run dev >>/Users/jean/projet/logs/front.log 2>&1 &
    disown
  )
else
  echo "✅ Front déjà en cours sur 5173"
fi

# 8) Attendre que le front réponde puis ouvrir le navigateur
echo "⏳ Attente disponibilité FRONT (http://127.0.0.1:5173)…"
for i in {1..30}; do  # ~30s max
  if curl -fsS http://127.0.0.1:5173 >/dev/null 2>&1; then
    echo "🌐 Ouverture du front → http://127.0.0.1:5173"
    open "http://127.0.0.1:5173"
    break
  fi
  echo "  … en attente ($i/30)"
  sleep 1
done