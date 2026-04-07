#!/bin/bash
set -e

echo "=== SvaPro Railway Startup ==="
echo "PORT: ${PORT:-8000}"
echo "DB_DATABASE: ${DB_DATABASE:-/app/database/database.sqlite}"

APP_DIR="/app"
DB_PATH="${DB_DATABASE:-/app/database/database.sqlite}"
DB_DIR="$(dirname "$DB_PATH")"

# 1. Crea directory necessarie
echo ">>> Creazione directory..."
mkdir -p \
    "$DB_DIR" \
    "$APP_DIR/storage/app/public" \
    "$APP_DIR/storage/framework/cache" \
    "$APP_DIR/storage/framework/sessions" \
    "$APP_DIR/storage/framework/views" \
    "$APP_DIR/storage/logs" \
    "$APP_DIR/bootstrap/cache"

# 2. Crea file SQLite
echo ">>> Database path: $DB_PATH"
touch "$DB_PATH"
echo ">>> DB file exists: $(ls -la $DB_PATH)"

# 3. Permessi
chmod -R 777 "$APP_DIR/storage" "$APP_DIR/bootstrap/cache" "$DB_DIR" 2>/dev/null || true

# 4. Crea .env (sempre, per sicurezza)
echo ">>> Creazione .env..."
cp "$APP_DIR/.env.railway" "$APP_DIR/.env"
sed -i "s|DB_DATABASE=.*|DB_DATABASE=$DB_PATH|g" "$APP_DIR/.env"
echo ">>> DB_DATABASE in .env: $(grep DB_DATABASE $APP_DIR/.env)"

# 5. Svuota cache (importante: prima di tutto)
echo ">>> Pulizia cache..."
php artisan config:clear --no-interaction
php artisan cache:clear --no-interaction
php artisan route:clear --no-interaction
php artisan view:clear --no-interaction

# 6. Esegui migrate con output visibile
echo ">>> Esecuzione migrate..."
php artisan migrate --force --no-interaction
echo ">>> Migrate completato con successo!"

# 7. Seed con output visibile
echo ">>> Seeding..."
php artisan db:seed --force --no-interaction || true
echo ">>> Seed completato!"

# 8. Config cache finale
echo ">>> Cache config..."
php artisan config:cache --no-interaction

echo "=== Avvio server su 0.0.0.0:${PORT:-8000} ==="
exec php artisan serve --host=0.0.0.0 --port="${PORT:-8000}"
