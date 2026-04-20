#!/bin/bash
# SvaPro — Container entrypoint

echo "========================================"
echo "  SvaPro — Avvio (PORT: ${PORT:-8000})"
echo "========================================"

# ─── 1. Railway env → .env ───────────────────────────────────────────────────
[ -n "$APP_KEY" ] && sed -i "s|APP_KEY=.*|APP_KEY=$APP_KEY|g" /app/.env 2>/dev/null || true
[ -n "$APP_URL" ] && sed -i "s|APP_URL=.*|APP_URL=$APP_URL|g" /app/.env 2>/dev/null || true

# ─── 2. Seleziona il database ────────────────────────────────────────────────
if [ -n "$DATABASE_URL" ]; then
    echo "✅ PostgreSQL: DATABASE_URL trovato"

    # Railway PostgreSQL espone anche variabili PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
    # Usiamo quelle direttamente — molto più affidabili del parsing dell'URL
    DB_HOST_VAL="${PGHOST:-$(echo "$DATABASE_URL" | sed -E 's|.*@([^/:]+)[:/].*|\1|')}"
    DB_PORT_VAL="${PGPORT:-$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/[^/?]*.*|\1|')}"
    DB_NAME_VAL="${PGDATABASE:-$(echo "$DATABASE_URL" | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')}"
    DB_USER_VAL="${PGUSER:-$(echo "$DATABASE_URL" | sed -E 's|.*://([^:@]+)[:@].*|\1|')}"
    DB_PASS_VAL="${PGPASSWORD:-$(echo "$DATABASE_URL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')}"

    # Fallback sicuri
    [ -z "$DB_HOST_VAL" ] && DB_HOST_VAL="localhost"
    [ -z "$DB_PORT_VAL" ] && DB_PORT_VAL="5432"
    [ -z "$DB_NAME_VAL" ] && DB_NAME_VAL="railway"
    [ -z "$DB_USER_VAL" ] && DB_USER_VAL="postgres"

    echo "   Host:  $DB_HOST_VAL:$DB_PORT_VAL"
    echo "   DB:    $DB_NAME_VAL  User: $DB_USER_VAL"

    # Esporta come variabili d'ambiente Laravel
    export DB_CONNECTION=pgsql
    export DB_HOST="$DB_HOST_VAL"
    export DB_PORT="$DB_PORT_VAL"
    export DB_DATABASE="$DB_NAME_VAL"
    export DB_USERNAME="$DB_USER_VAL"
    export DB_PASSWORD="$DB_PASS_VAL"

    # Aggiorna .env in modo sicuro
    sed -i "s|DB_CONNECTION=.*|DB_CONNECTION=pgsql|g" /app/.env 2>/dev/null || true
    grep -q "^DB_HOST=" /app/.env && sed -i "s|^DB_HOST=.*|DB_HOST=${DB_HOST_VAL}|g" /app/.env || echo "DB_HOST=${DB_HOST_VAL}" >> /app/.env
    grep -q "^DB_PORT=" /app/.env && sed -i "s|^DB_PORT=.*|DB_PORT=${DB_PORT_VAL}|g" /app/.env || echo "DB_PORT=${DB_PORT_VAL}" >> /app/.env
    grep -q "^DB_DATABASE=" /app/.env && sed -i "s|^DB_DATABASE=.*|DB_DATABASE=${DB_NAME_VAL}|g" /app/.env || echo "DB_DATABASE=${DB_NAME_VAL}" >> /app/.env
    grep -q "^DB_USERNAME=" /app/.env && sed -i "s|^DB_USERNAME=.*|DB_USERNAME=${DB_USER_VAL}|g" /app/.env || echo "DB_USERNAME=${DB_USER_VAL}" >> /app/.env
    grep -q "^DB_PASSWORD=" /app/.env && sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASS_VAL}|g" /app/.env || echo "DB_PASSWORD=${DB_PASS_VAL}" >> /app/.env

    DB_MODE="pgsql"

else
    DB_PATH="/app/storage/database.sqlite"
    echo "📁 SQLite: $DB_PATH"

    export DB_CONNECTION=sqlite
    export DB_DATABASE="$DB_PATH"
    [ ! -f "$DB_PATH" ] && touch "$DB_PATH" && chmod 666 "$DB_PATH"

    sed -i "s|DB_CONNECTION=.*|DB_CONNECTION=sqlite|g" /app/.env 2>/dev/null || true
    sed -i "s|DB_DATABASE=.*|DB_DATABASE=$DB_PATH|g"   /app/.env 2>/dev/null || true

    DB_MODE="sqlite"
fi

# ─── 3. Pulizia config cache ─────────────────────────────────────────────────
php artisan config:clear --no-interaction 2>/dev/null || true

# ─── 4. Test connessione DB ─────────────────────────────────────────────────
echo "▶ Test connessione database ($DB_MODE)..."
DB_TEST=$(php artisan tinker --execute="echo 'OK:'.DB::connection()->getDatabaseName();" 2>&1)
if echo "$DB_TEST" | grep -q "^OK:"; then
    echo "✅ DB connesso: $(echo "$DB_TEST" | grep "^OK:" | sed 's/^OK://')"
else
    echo "❌ ERRORE CONNESSIONE DB:"
    echo "$DB_TEST"
    echo ""
    echo "   DB_CONNECTION=$DB_CONNECTION"
    echo "   DB_HOST=$DB_HOST"
    echo "   DB_PORT=$DB_PORT"
    echo "   DB_DATABASE=$DB_DATABASE"
    echo "   DB_USERNAME=$DB_USERNAME"
    exit 1
fi

# ─── 5. Migrazioni ───────────────────────────────────────────────────────────
echo "▶ Migrazioni ($DB_MODE)..."
MIGRATE_OUT=$(php artisan migrate --force --no-interaction 2>&1)
MIGRATE_EXIT=$?
echo "$MIGRATE_OUT"

if [ $MIGRATE_EXIT -ne 0 ]; then
    echo "❌ migrate --force fallito (exit $MIGRATE_EXIT) — crash del container"
    exit 1
fi
echo "✅ Migrate OK"

# ─── 6. Seed — solo se il DB è vuoto (prima installazione) ──────────────────
echo "▶ Seed..."
php artisan db:seed --force --no-interaction 2>&1 || echo "⚠️  Seed skipped o fallito"

# ─── 7. Storage link ─────────────────────────────────────────────────────────
php artisan storage:link --force 2>/dev/null || true

echo ""
echo "========================================"
echo "  🚀 FrankenPHP: 0.0.0.0:${PORT:-8000}"
echo "========================================"

exec frankenphp php-server \
    --listen ":${PORT:-8000}" \
    --root /app/public
