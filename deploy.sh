#!/bin/bash
# ════════════════════════════════════════════════════════════════════════════
#  E-Station — Script de déploiement production
#  Usage : bash deploy.sh
#
#  Prérequis sur le VPS :
#    1. Copier tout le projet dans un dossier (ex: /opt/estation/)
#    2. Copier .env.prod.example → .env.prod et remplir les valeurs
#    3. Vérifier le nom du certresolver Traefik (voir étape 0 ci-dessous)
#    4. Lancer : bash deploy.sh
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"
DOMAIN="estation.gsoft-bf.com"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$PROJECT_DIR"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║      Déploiement E-Station               ║"
echo "║      https://$DOMAIN  ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Étape 0 : Vérification du certresolver Traefik ───────────────────────────
echo "▶ [0/7] Vérification de l'environnement..."

# Affiche le nom du certresolver configuré dans Traefik
CERTRESOLVER=$(docker inspect traefik-traefik-1 --format '{{json .Config.Cmd}}' 2>/dev/null \
    | grep -o '"--certificatesresolvers\.[^"]*\.acme' \
    | head -1 \
    | sed 's/--certificatesresolvers\.\(.*\)\.acme/\1/' || echo "inconnu")

if [ "$CERTRESOLVER" = "inconnu" ]; then
    echo ""
    echo "  ⚠️  Impossible de détecter le nom du certresolver Traefik automatiquement."
    echo "     Pour le trouver manuellement :"
    echo "     docker inspect traefik-traefik-1 --format '{{json .Config.Cmd}}'"
    echo "     Chercher : --certificatesresolvers.<NOM>.acme..."
    echo ""
    echo "     Le fichier docker-compose.prod.yml utilise 'letsencrypt' par défaut."
    echo "     Si votre certresolver a un autre nom, modifiez la ligne :"
    echo "       traefik.http.routers.estation.tls.certresolver=letsencrypt"
    echo "     dans docker-compose.prod.yml avant de continuer."
    echo ""
    read -rp "  Appuyer sur Entrée pour continuer quand même, ou Ctrl+C pour annuler : "
else
    echo "  ✅ Certresolver Traefik détecté : '$CERTRESOLVER'"
    if [ "$CERTRESOLVER" != "letsencrypt" ]; then
        echo "  ⚠️  Le certresolver s'appelle '$CERTRESOLVER' (pas 'letsencrypt')."
        echo "     Mise à jour automatique dans docker-compose.prod.yml..."
        sed -i "s/certresolver=letsencrypt/certresolver=$CERTRESOLVER/g" "$COMPOSE_FILE"
        echo "  ✅ docker-compose.prod.yml mis à jour."
    fi
fi

# ── Étape 1 : Vérification du .env.prod ──────────────────────────────────────
echo ""
echo "▶ [1/7] Vérification du fichier $ENV_FILE..."

if [ ! -f "$ENV_FILE" ]; then
    echo "  ❌ Fichier $ENV_FILE introuvable."
    echo "     Copier .env.prod.example → .env.prod et remplir les valeurs CHANGE_ME."
    exit 1
fi

if grep -q "CHANGE_ME" "$ENV_FILE"; then
    echo "  ❌ Le fichier $ENV_FILE contient encore des valeurs CHANGE_ME non remplies."
    grep -n "CHANGE_ME" "$ENV_FILE"
    exit 1
fi

echo "  ✅ $ENV_FILE OK"

# ── Étape 2 : Vérification du réseau Traefik ─────────────────────────────────
echo ""
echo "▶ [2/7] Vérification du réseau Docker 'web'..."

if ! docker network inspect web >/dev/null 2>&1; then
    echo "  ❌ Réseau Docker 'web' introuvable."
    echo "     Vérifier que Traefik est démarré : docker ps | grep traefik"
    exit 1
fi

echo "  ✅ Réseau 'web' présent"

# ── Étape 3 : Build des images ───────────────────────────────────────────────
echo ""
echo "▶ [3/7] Build des images Docker (peut prendre quelques minutes)..."

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache

echo "  ✅ Images construites"

# ── Étape 4 : Démarrage de PostgreSQL ────────────────────────────────────────
echo ""
echo "▶ [4/7] Démarrage de PostgreSQL..."

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d db

echo "  Attente que PostgreSQL soit prêt (max 30s)..."
for i in $(seq 1 30); do
    if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
        exec -T db pg_isready -U "$(grep POSTGRES_USER "$ENV_FILE" | cut -d= -f2)" \
        >/dev/null 2>&1; then
        echo "  ✅ PostgreSQL prêt (${i}s)"
        break
    fi
    sleep 1
done

# ── Étape 5 : Migrations Django ───────────────────────────────────────────────
echo ""
echo "▶ [5/7] Migrations Django..."

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
    run --rm backend python manage.py migrate --noinput

echo "  ✅ Migrations appliquées"

# ── Étape 6 : Collectstatic ───────────────────────────────────────────────────
echo ""
echo "▶ [6/7] Collectstatic (fichiers admin + swagger)..."

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
    run --rm backend python manage.py collectstatic --noinput

echo "  ✅ Fichiers statiques collectés"

# ── Étape 7 : Démarrage complet ───────────────────────────────────────────────
echo ""
echo "▶ [7/7] Démarrage de tous les services..."

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

sleep 3

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✅ E-Station déployé avec succès !                  ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  🌐 Application  : https://$DOMAIN"
echo "  🔧 Django Admin : https://$DOMAIN/admin/"
echo "  📖 API Docs     : https://$DOMAIN/api/v1/docs/"
echo ""

docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "──────────────────────────────────────────────────────"
echo "  Si c'est la PREMIÈRE installation, créer le superadmin :"
echo ""
echo "  docker compose -f docker-compose.prod.yml --env-file .env.prod \\"
echo "    run --rm backend python manage.py createsuperuser"
echo ""
echo "  Commandes utiles :"
echo "  • Logs backend  : docker logs estation_backend -f"
echo "  • Logs nginx    : docker logs estation_nginx -f"
echo "  • Logs db       : docker logs estation_db -f"
echo "  • Arrêter       : docker compose -f docker-compose.prod.yml down"
echo "──────────────────────────────────────────────────────"
