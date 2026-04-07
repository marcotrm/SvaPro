#!/bin/bash
set -e

echo "=== SvaPro Railway Startup ==="

# --- 1. Ensure storage dirs exist ---
mkdir -p storage/app/public storage/framework/{cache,sessions,views} storage/logs bootstrap/cache

# --- 2. Fix permissions ---
chmod -R 775 storage bootstrap/cache

# --- 3. Create SQLite database file if it doesn't exist ---
if [ ! -f database/database.sqlite ]; then
    echo "Creating SQLite database..."
    touch database/database.sqlite
fi

# --- 4. Copy .env if it doesn't exist ---
if [ ! -f .env ]; then
    echo "Creating .env from Railway environment variables..."
    cp .env.railway .env
fi

# --- 5. Generate app key if not set ---
if ! grep -q "APP_KEY=base64:" .env; then
    php artisan key:generate --force
fi

# --- 6. Run migrations ---
echo "Running migrations..."
php artisan migrate --force --no-interaction 2>/dev/null || true

# --- 7. Run only the core seeder (creates admin user, tenant, etc.) ---
echo "Running seeders..."
php artisan db:seed --class=DatabaseSeeder --force --no-interaction 2>/dev/null || true
php artisan db:seed --class=AdminUserSeeder --force --no-interaction 2>/dev/null || true

# --- 8. Build frontend assets ---
echo "Building frontend assets..."
npm ci --silent 2>/dev/null || npm install --silent
npm run build 2>/dev/null || true

# --- 9. Cache config for performance ---
php artisan config:cache --no-interaction 2>/dev/null || true
php artisan route:cache --no-interaction 2>/dev/null || true

# --- 10. Start the server ---
echo "=== Starting PHP server on port ${PORT:-8000} ==="
php artisan serve --host=0.0.0.0 --port="${PORT:-8000}"
