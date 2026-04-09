#!/bin/bash
# SvaPro — Container entrypoint (nessun set -e — errori gestiti manualmente)

echo "========================================"
echo "  SvaPro — Avvio (PORT: ${PORT:-8000})"
echo "========================================"

# ─── 1. Railway env → .env ───────────────────────────────────────────────────
[ -n "$APP_KEY" ] && sed -i "s|APP_KEY=.*|APP_KEY=$APP_KEY|g" /app/.env 2>/dev/null || true
[ -n "$APP_URL" ] && sed -i "s|APP_URL=.*|APP_URL=$APP_URL|g" /app/.env 2>/dev/null || true

# ─── 2. Seleziona il database ────────────────────────────────────────────────
if [ -n "$DATABASE_URL" ]; then
    echo "✅ PostgreSQL rilevato"

    # Railway fornisce sia DATABASE_URL che singole variabili PGHOST, PGPORT, ecc.
    # Usiamo quelle individuali che sono più affidabili del parsing URL.
    PGHOST_VAL="${PGHOST:-}"
    PGPORT_VAL="${PGPORT:-5432}"
    PGDATABASE_VAL="${PGDATABASE:-railway}"
    PGUSER_VAL="${PGUSER:-postgres}"
    PGPASSWORD_VAL="${PGPASSWORD:-}"

    # Se Railway non ha già i PG* separati, prova a parserli da DATABASE_URL
    if [ -z "$PGHOST_VAL" ]; then
        PGHOST_VAL=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/?]*\).*|\1|p')
        PGPORT_VAL=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
        PGDATABASE_VAL=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
        PGUSER_VAL=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
        PGPASSWORD_VAL=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
    fi

    echo "   Host: $PGHOST_VAL:$PGPORT_VAL / DB: $PGDATABASE_VAL"

    # Esporta variabili singole — questo è il modo più affidabile con Laravel
    export DB_CONNECTION=pgsql
    export DB_HOST="$PGHOST_VAL"
    export DB_PORT="$PGPORT_VAL"
    export DB_DATABASE="$PGDATABASE_VAL"
    export DB_USERNAME="$PGUSER_VAL"
    export DB_PASSWORD="$PGPASSWORD_VAL"
    unset DB_URL  # evita conflitti con URL parsing

    # Aggiorna .env per coerenza
    sed -i "s|DB_CONNECTION=.*|DB_CONNECTION=pgsql|g" /app/.env 2>/dev/null || true
    {
        grep -q "^DB_HOST=" /app/.env && sed -i "s|DB_HOST=.*|DB_HOST=$PGHOST_VAL|g" /app/.env || echo "DB_HOST=$PGHOST_VAL" >> /app/.env
        grep -q "^DB_PORT=" /app/.env && sed -i "s|DB_PORT=.*|DB_PORT=$PGPORT_VAL|g" /app/.env || echo "DB_PORT=$PGPORT_VAL" >> /app/.env
        grep -q "^DB_DATABASE=" /app/.env && sed -i "s|DB_DATABASE=.*|DB_DATABASE=$PGDATABASE_VAL|g" /app/.env || echo "DB_DATABASE=$PGDATABASE_VAL" >> /app/.env
        grep -q "^DB_USERNAME=" /app/.env && sed -i "s|DB_USERNAME=.*|DB_USERNAME=$PGUSER_VAL|g" /app/.env || echo "DB_USERNAME=$PGUSER_VAL" >> /app/.env
        grep -q "^DB_PASSWORD=" /app/.env && sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=$PGPASSWORD_VAL|g" /app/.env || echo "DB_PASSWORD=$PGPASSWORD_VAL" >> /app/.env
    } 2>/dev/null || true

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
# NOTA: non eseguiamo config:cache qui perché causa problemi con env dinamici

# ─── 4. Migrazioni (OBBLIGATORIE — se falliscono il container crasha) ────────
echo "▶ Migrazioni ($DB_MODE)..."
if php artisan migrate --force --no-interaction 2>&1; then
    echo "✅ Migrate OK"
else
    echo "❌ MIGRATE FALLITO — controlla i log per i dettagli"
    echo "   Uscita del container per permettere il debugging"
    exit 1
fi

# ─── 5. Seed (sempre — il seeder si auto-protegge) ───────────────────────────
echo "▶ Seed..."
php artisan db:seed --force --no-interaction 2>&1 || echo "⚠️  Seed skipped/fallito"

# ─── 6. Storage link ─────────────────────────────────────────────────────────
php artisan storage:link --force 2>/dev/null || true

echo ""
echo "========================================"
echo "  🚀 FrankenPHP: 0.0.0.0:${PORT:-8000}"
echo "========================================"

exec frankenphp php-server \
    --listen ":${PORT:-8000}" \
    --root /app/public
