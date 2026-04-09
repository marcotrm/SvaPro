#!/bin/bash
set -e

echo "=== SvaPro Avvio ==="
echo "PORT: ${PORT:-8000}"

# ─── Inietta variabili Railway nel .env ─────────────
[ -n "$APP_KEY" ]   && sed -i "s|APP_KEY=.*|APP_KEY=$APP_KEY|g" /app/.env
[ -n "$APP_URL" ]   && sed -i "s|APP_URL=.*|APP_URL=$APP_URL|g" /app/.env && \
    sed -i "s|CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=$APP_URL|g" /app/.env

# ─── Auto-configura PostgreSQL se DATABASE_URL è presente ───
if [ -n "$DATABASE_URL" ]; then
    echo "✅ DATABASE_URL rilevato — uso PostgreSQL"
    sed -i "s|DB_CONNECTION=.*|DB_CONNECTION=pgsql|g" /app/.env
    grep -q "^DATABASE_URL=" /app/.env && \
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|g" /app/.env || \
        echo "DATABASE_URL=$DATABASE_URL" >> /app/.env
else
    # ─── SQLite: assicura che il file esista (volume persistente) ───
    DB_PATH="/app/storage/database.sqlite"
    if [ ! -f "$DB_PATH" ]; then
        echo "🆕 DB SQLite non trovato — creo e migro..."
        touch "$DB_PATH"
        chmod 666 "$DB_PATH"
    else
        echo "✅ DB SQLite trovato ($(du -sh $DB_PATH | cut -f1))"
    fi
fi

# ─── Config + migrate ────────────────────────────────
php artisan config:clear --no-interaction
php artisan config:cache --no-interaction
php artisan migrate --force --no-interaction
php artisan storage:link --force 2>/dev/null || true

echo "=== Server avviato su 0.0.0.0:${PORT:-8000} ==="
exec php artisan serve --host=0.0.0.0 --port="${PORT:-8000}"
