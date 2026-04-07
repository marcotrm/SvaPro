#!/bin/bash
set -e

echo "=== SvaPro Avvio ==="
echo "PORT: ${PORT:-8000}"
echo "DB: /app/storage/database.sqlite"
ls -la /app/storage/database.sqlite 2>/dev/null || echo "WARN: DB non trovato!"

# Inietta variabili Railway nel .env
[ -n "$APP_KEY" ] && sed -i "s|APP_KEY=.*|APP_KEY=$APP_KEY|g" /app/.env
[ -n "$APP_URL" ] && sed -i "s|APP_URL=.*|APP_URL=$APP_URL|g" /app/.env && \
    sed -i "s|CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=$APP_URL|g" /app/.env

# Aggiorna config cache
php artisan config:clear --no-interaction
php artisan config:cache --no-interaction

echo "=== Server avviato su 0.0.0.0:${PORT:-8000} ==="
exec php artisan serve --host=0.0.0.0 --port="${PORT:-8000}"
