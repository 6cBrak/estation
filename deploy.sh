#!/bin/bash
# ════════════════════════════════════════════════════════════════════════════
#  E-Station — Script de déploiement production
#  Usage : bash deploy.sh
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

# ── Étape 0 : Génération du .env.prod si absent ───────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
    echo "▶ Configuration initiale — répondre aux questions suivantes :"
    echo ""

    # Secret key Django
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(50))")
    echo "  ✅ DJANGO_SECRET_KEY générée automatiquement"

    # Mot de passe base de données
    while true; do
        read -rsp "  Mot de passe PostgreSQL (min 8 caractères) : " DB_PASSWORD
        echo ""
        if [ ${#DB_PASSWORD} -ge 8 ]; then
            read -rsp "  Confirmer le mot de passe : " DB_PASSWORD2
            echo ""
            if [ "$DB_PASSWORD" = "$DB_PASSWORD2" ]; then
                break
            else
                echo "  ❌ Les mots de passe ne correspondent pas. Réessayer."
            fi
        else
            echo "  ❌ Mot de passe trop court (minimum 8 caractères)."
        fi
    done
    echo "  ✅ Mot de passe PostgreSQL défini"

    # Email (optionnel)
    echo ""
    read -rp "  Adresse email pour les rapports (laisser vide pour ignorer) : " BOSS_EMAIL
    read -rp "  Email d'envoi SMTP Gmail (laisser vide pour ignorer) : " SMTP_USER
    SMTP_PASS=""
    if [ -n "$SMTP_USER" ]; then
        read -rsp "  Mot de passe application Gmail : " SMTP_PASS
        echo ""
    fi

    # Génération du fichier
    cat > "$ENV_FILE" <<EOF
# Généré automatiquement par deploy.sh — NE PAS COMMITER
DJANGO_SECRET_KEY=${SECRET_KEY}
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=${DOMAIN}

DATABASE_URL=postgresql://estation:${DB_PASSWORD}@estation_db:5432/estation
POSTGRES_DB=estation
POSTGRES_USER=estation
POSTGRES_PASSWORD=${DB_PASSWORD}

JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7

CORS_ALLOWED_ORIGINS=https://${DOMAIN}

EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
EMAIL_HOST_USER=${SMTP_USER}
EMAIL_HOST_PASSWORD=${SMTP_PASS}
EMAIL_FROM=E-Station <noreply@gsoft-bf.com>
BOSS_EMAIL=${BOSS_EMAIL}
EOF

    echo ""
    echo "  ✅ Fichier $ENV_FILE créé"

else
    echo "▶ Fichier $ENV_FILE existant détecté — utilisation sans modification."
    if grep -q "CHANGE_ME" "$ENV_FILE"; then
        echo "  ❌ Le fichier contient encore des valeurs CHANGE_ME non remplies :"
        grep -n "CHANGE_ME" "$ENV_FILE"
        exit 1
    fi
    echo "  ✅ $ENV_FILE OK"
fi

# ── Étape 1 : Vérification du certresolver Traefik ───────────────────────────
echo ""
echo "▶ [1/6] Vérification de Traefik..."

CERTRESOLVER=$(docker inspect traefik-traefik-1 --format '{{json .Config.Cmd}}' 2>/dev/null \
    | grep -oP '(?<=certificatesresolvers\.)[^.]+(?=\.acme)' \
    | head -1 || echo "inconnu")

if [ "$CERTRESOLVER" = "inconnu" ] || [ -z "$CERTRESOLVER" ]; then
    echo "  ⚠️  Certresolver Traefik non détecté — 'letsencrypt' utilisé par défaut."
    echo "     Si le SSL ne fonctionne pas, vérifier avec :"
    echo "     docker inspect traefik-traefik-1 --format '{{json .Config.Cmd}}'"
else
    echo "  ✅ Certresolver détecté : '$CERTRESOLVER'"
    if [ "$CERTRESOLVER" != "letsencrypt" ]; then
        sed -i "s/certresolver=letsencrypt/certresolver=$CERTRESOLVER/g" "$COMPOSE_FILE"
        echo "  ✅ docker-compose.prod.yml mis à jour avec '$CERTRESOLVER'"
    fi
fi

if ! docker network inspect web >/dev/null 2>&1; then
    echo "  ❌ Réseau Docker 'web' introuvable. Traefik est-il démarré ?"
    exit 1
fi
echo "  ✅ Réseau 'web' présent"

# ── Étape 2 : Build des images ───────────────────────────────────────────────
echo ""
echo "▶ [2/6] Build des images Docker (quelques minutes)..."

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache

echo "  ✅ Images construites"

# ── Étape 3 : Démarrage PostgreSQL + migrations ───────────────────────────────
echo ""
echo "▶ [3/6] Démarrage de PostgreSQL..."

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d db

echo "  Attente que PostgreSQL soit prêt (max 30s)..."
for i in $(seq 1 30); do
    if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
        exec -T db pg_isready -U estation >/dev/null 2>&1; then
        echo "  ✅ PostgreSQL prêt (${i}s)"
        break
    fi
    sleep 1
done

# ── Étape 4 : Migrations Django ───────────────────────────────────────────────
echo ""
echo "▶ [4/6] Migrations Django..."

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
    run --rm backend python manage.py migrate --noinput

echo "  ✅ Migrations appliquées"

# ── Étape 5 : Collectstatic ───────────────────────────────────────────────────
echo ""
echo "▶ [5/6] Collectstatic..."

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
    run --rm backend python manage.py collectstatic --noinput

echo "  ✅ Fichiers statiques collectés"

# ── Étape 6 : Démarrage complet ───────────────────────────────────────────────
echo ""
echo "▶ [6/6] Démarrage de tous les services..."

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

sleep 3

# ── Première installation : créer le superadmin ───────────────────────────────
echo ""
if [ ! -f ".superadmin_created" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  PREMIÈRE INSTALLATION — Créer le compte administrateur"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
        run --rm backend python manage.py createsuperuser
    touch .superadmin_created
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✅ E-Station déployé avec succès !                  ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Application  : https://$DOMAIN"
echo "  Django Admin : https://$DOMAIN/admin/"
echo "  API Docs     : https://$DOMAIN/api/v1/docs/"
echo ""

docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "  Commandes utiles :"
echo "  • Logs backend  : docker logs estation_backend -f"
echo "  • Logs nginx    : docker logs estation_nginx -f"
echo "  • Mettre à jour : git pull && bash deploy.sh"
echo ""
