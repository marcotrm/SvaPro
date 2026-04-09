#!/bin/bash
set -e

echo "============================================"
echo "  SvaPro — Avvio Container"
echo "  PORT: ${PORT:-8000}"
echo "============================================"

# ─── Inietta variabili Railway dal env ───────────────────────────────────────
[ -n "$APP_KEY" ] && sed -i "s|APP_KEY=.*|APP_KEY=$APP_KEY|g" /app/.env
[ -n "$APP_URL" ] && {
    sed -i "s|APP_URL=.*|APP_URL=$APP_URL|g" /app/.env
    sed -i "s|CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=$APP_URL|g" /app/.env
}

# ─── Database: PostgreSQL se DATABASE_URL è presente, altrimenti SQLite ──────
if [ -n "$DATABASE_URL" ]; then
    echo "✅ DATABASE_URL trovato — uso PostgreSQL"
    # Rimuovi eventuali variabili conflittuali e imposta pgsql
    sed -i "s|DB_CONNECTION=.*|DB_CONNECTION=pgsql|g" /app/.env
    grep -q "^DATABASE_URL=" /app/.env \
        && sed -i "s|DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|g" /app/.env \
        || echo "DATABASE_URL=$DATABASE_URL" >> /app/.env
    DB_MODE="pgsql"
else
    # SQLite con volume persistente
    DB_PATH="/app/storage/database.sqlite"
    echo "📁 Modalità SQLite: $DB_PATH"
    if [ ! -f "$DB_PATH" ]; then
        echo "🆕 File DB non trovato — creo..."
        touch "$DB_PATH"
        chmod 666 "$DB_PATH"
    else
        echo "✅ DB SQLite esistente ($(du -sh $DB_PATH | cut -f1))"
    fi
    sed -i "s|DB_CONNECTION=.*|DB_CONNECTION=sqlite|g" /app/.env
    sed -i "s|DB_DATABASE=.*|DB_DATABASE=$DB_PATH|g" /app/.env
    DB_MODE="sqlite"
fi

# ─── Pulizia cache config ─────────────────────────────────────────────────────
php artisan config:clear --no-interaction 2>/dev/null || true

# ─── Migrazioni ───────────────────────────────────────────────────────────────
echo "▶ Eseguo migrazioni ($DB_MODE)..."
php artisan migrate --force --no-interaction
echo "✅ Migrazioni completate"

# ─── Seed automatico al primo avvio (DB vuoto) ───────────────────────────────
echo "▶ Controllo se il seed è necessario..."
NEEDS_SEED=$(php -r "
define('LARAVEL_START', microtime(true));
require '/app/vendor/autoload.php';
\$app = require_once '/app/bootstrap/app.php';
\$kernel = \$app->make(Illuminate\Contracts\Console\Kernel::class);
\$kernel->bootstrap();
try {
    \$count = Illuminate\Support\Facades\DB::table('users')->count();
    echo (\$count === 0) ? 'yes' : 'no';
} catch (\Throwable \$e) {
    echo 'yes';
}
" 2>/dev/null || echo "yes")

if [ "$NEEDS_SEED" = "yes" ]; then
    echo "🌱 DB vuoto — eseguo db:seed..."
    php artisan db:seed --force --no-interaction
    echo "✅ Seed completato"
else
    echo "✅ DB già popolato — seed non necessario"
fi

# ─── Storage link ─────────────────────────────────────────────────────────────
php artisan storage:link --force 2>/dev/null || true

echo ""
echo "============================================"
echo "  🚀 Server su 0.0.0.0:${PORT:-8000}"
echo "============================================"
exec php artisan serve --host=0.0.0.0 --port="${PORT:-8000}"
