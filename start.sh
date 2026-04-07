#!/bin/bash
set -e

echo "=== SvaPro Railway Startup ==="
echo "Port: ${PORT:-8000}"
echo "Working dir: $(pwd)"

# --- 1. Imposta path corretti ---
APP_DIR="/app"
# Il Volume Railway è montato in /app/database (come configurato su Railway)
DB_PATH="${DB_DATABASE:-/app/database/database.sqlite}"

# --- 2. Crea le directory necessarie ---
mkdir -p \
    "$(dirname "$DB_PATH")" \
    "$APP_DIR/storage/app/public" \
    "$APP_DIR/storage/framework/cache" \
    "$APP_DIR/storage/framework/sessions" \
    "$APP_DIR/storage/framework/views" \
    "$APP_DIR/storage/logs" \
    "$APP_DIR/bootstrap/cache"

# --- 3. Crea il file SQLite se non esiste ---
if [ ! -f "$DB_PATH" ]; then
    echo ">>> Creazione database SQLite: $DB_PATH"
    touch "$DB_PATH"
fi

# --- 4. Prepara .env dal template Railway ---
if [ ! -f "$APP_DIR/.env" ]; then
    echo ">>> Creazione .env da .env.railway"
    cp "$APP_DIR/.env.railway" "$APP_DIR/.env"
    # Imposta il path del DB corretto
    sed -i "s|DB_DATABASE=.*|DB_DATABASE=$DB_PATH|g" "$APP_DIR/.env"
fi

# --- 5. Genera APP_KEY se manca ---
if ! grep -q "APP_KEY=base64:" "$APP_DIR/.env" 2>/dev/null; then
    echo ">>> Generazione APP_KEY..."
    php artisan key:generate --force
fi

# --- 6. Fix permessi ---
chmod -R 775 \
    "$APP_DIR/storage" \
    "$APP_DIR/bootstrap/cache" \
    "$APP_DIR/database" 2>/dev/null || true

# --- 7. Pulizia cache e migrate ---
echo ">>> Pulizia cache..."
php artisan config:clear --no-interaction 2>/dev/null || true
php artisan cache:clear --no-interaction 2>/dev/null || true

echo ">>> Esecuzione migrazioni..."
php artisan migrate --force --no-interaction 2>/dev/null || {
    echo "WARN: migrate fallito, continuo..."
}

# --- 8. Seed (admin + tenant setup) ---
echo ">>> Seeding database..."
php artisan db:seed --class=DatabaseSeeder --force --no-interaction 2>/dev/null || true
php artisan db:seed --class=AdminUserSeeder --force --no-interaction 2>/dev/null || true

# --- 9. Cache config per performance ---
echo ">>> Cache configurazione..."
php artisan config:cache --no-interaction 2>/dev/null || true

echo "=== Avvio server su 0.0.0.0:${PORT:-8000} ==="
exec php artisan serve --host=0.0.0.0 --port="${PORT:-8000}"
