#!/bin/bash
# NON usare set -e — gestiamo gli errori manualmente per evitare crash del container

echo "============================================"
echo "  SvaPro — Avvio Container"
echo "  PORT: ${PORT:-8000}"
echo "============================================"

# ─── Inietta variabili Railway nel .env ──────────────────────────────────────
[ -n "$APP_KEY" ]  && sed -i "s|APP_KEY=.*|APP_KEY=$APP_KEY|g"         /app/.env
[ -n "$APP_URL" ]  && sed -i "s|APP_URL=.*|APP_URL=$APP_URL|g"         /app/.env
[ -n "$APP_URL" ]  && sed -i "s|CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=$APP_URL|g" /app/.env

# ─── Database: PostgreSQL (DATABASE_URL) o SQLite (volume) ───────────────────
if [ -n "$DATABASE_URL" ]; then
    echo "✅ DATABASE_URL trovato — uso PostgreSQL"

    # Esporta esplicitamente — sovrascrive eventuali variabili conflittuali di Railway
    export DB_CONNECTION=pgsql
    export DB_URL="$DATABASE_URL"
    unset DB_DATABASE  # lascia che Laravel parsi DATABASE_URL

    # Aggiorna .env per consistenza
    sed -i "s|DB_CONNECTION=.*|DB_CONNECTION=pgsql|g" /app/.env
    grep -q "^DATABASE_URL=" /app/.env \
        && sed -i "s|DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|g" /app/.env \
        || echo "DATABASE_URL=$DATABASE_URL" >> /app/.env

    DB_MODE="pgsql"
else
    DB_PATH="/app/storage/database.sqlite"
    echo "📁 Modalità SQLite: $DB_PATH"

    export DB_CONNECTION=sqlite
    export DB_DATABASE="$DB_PATH"

    if [ ! -f "$DB_PATH" ]; then
        echo "🆕 File DB non trovato — creo..."
        touch "$DB_PATH" && chmod 666 "$DB_PATH"
    else
        SIZE=$(du -sh "$DB_PATH" 2>/dev/null | cut -f1 || echo "?")
        echo "✅ DB SQLite esistente ($SIZE)"
    fi

    sed -i "s|DB_CONNECTION=.*|DB_CONNECTION=sqlite|g" /app/.env
    sed -i "s|DB_DATABASE=.*|DB_DATABASE=$DB_PATH|g"   /app/.env
    DB_MODE="sqlite"
fi

# ─── Pulizia cache ───────────────────────────────────────────────────────────
php artisan config:clear --no-interaction 2>/dev/null || true

# ─── Migrazioni (obbligatorie — fallisce = container non parte) ──────────────
echo "▶ Migrazioni ($DB_MODE)..."
if ! php artisan migrate --force --no-interaction; then
    echo "❌ ERRORE MIGRAZIONI — impossibile continuare"
    exit 1
fi
echo "✅ Migrazioni completate"

# ─── Seed automatico al primo avvio ─────────────────────────────────────────
# Usa `php artisan tinker` per controllare se il DB è vuoto
echo "▶ Controllo seed..."
NEEDS_SEED="no"
USER_COUNT=$(php artisan tinker --execute="echo \App\Models\User::count();" 2>/dev/null | grep -oE '^[0-9]+' | head -1)
if [ -z "$USER_COUNT" ] || [ "$USER_COUNT" = "0" ]; then
    NEEDS_SEED="yes"
fi

if [ "$NEEDS_SEED" = "yes" ]; then
    echo "🌱 DB vuoto — eseguo seed..."
    if php artisan db:seed --force --no-interaction 2>&1; then
        echo "✅ Seed completato"
    else
        echo "⚠️  Seed fallito o parziale — l'app continua comunque"
    fi
else
    echo "✅ DB già popolato (${USER_COUNT} utenti) — seed saltato"
fi

# ─── Storage link ────────────────────────────────────────────────────────────
php artisan storage:link --force 2>/dev/null || true

echo ""
echo "============================================"
echo "  🚀 Server su 0.0.0.0:${PORT:-8000}"
echo "============================================"
exec php artisan serve --host=0.0.0.0 --port="${PORT:-8000}"
