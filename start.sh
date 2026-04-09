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
    # Aggiungi DATABASE_URL se non presente
    grep -q "^DATABASE_URL=" /app/.env && \
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|g" /app/.env || \
        echo "DATABASE_URL=$DATABASE_URL" >> /app/.env
else
    echo "⚠️  DATABASE_URL non trovato — uso SQLite locale"
    echo "DB: /app/storage/database.sqlite"
    ls -la /app/storage/database.sqlite 2>/dev/null || echo "WARN: DB non trovato, verrà creato"
    touch /app/storage/database.sqlite 2>/dev/null || true
fi

# ─── Configura cache e migra ────────────────────────
php artisan config:clear --no-interaction
php artisan config:cache --no-interaction
php artisan migrate --force --no-interaction
php artisan storage:link --force 2>/dev/null || true

echo "=== Server avviato su 0.0.0.0:${PORT:-8000} ==="
exec php artisan serve --host=0.0.0.0 --port="${PORT:-8000}"
