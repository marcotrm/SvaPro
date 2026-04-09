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

    # Railway PostgreSQL fornisce DATABASE_URL nel formato:
    # postgresql://user:pass@host:port/dbname
    # Estraiamo le componenti con sed

    _URL="$DATABASE_URL"
    DB_HOST_VAL=$(echo "$_URL" | sed -E 's|.*@([^/:]+):[0-9]+/.*|\1|')
    DB_PORT_VAL=$(echo "$_URL" | sed -E 's|.*:([0-9]+)/[^/]+$|\1|')
    DB_NAME_VAL=$(echo "$_URL" | sed -E 's|.*/([^?]+).*|\1|')
    DB_USER_VAL=$(echo "$_URL" | sed -E 's|[a-z]+://([^:]+):.*|\1|')
    DB_PASS_VAL=$(echo "$_URL" | sed -E 's|[a-z]+://[^:]+:([^@]+)@.*|\1|')

    # Fallback alle variabili PGHOST/PGPORT/etc. se il parsing fallisce
    [ -z "$DB_HOST_VAL" ] && DB_HOST_VAL="${PGHOST:-localhost}"
    [ -z "$DB_PORT_VAL" ] && DB_PORT_VAL="${PGPORT:-5432}"
    [ -z "$DB_NAME_VAL" ] && DB_NAME_VAL="${PGDATABASE:-railway}"
    [ -z "$DB_USER_VAL" ] && DB_USER_VAL="${PGUSER:-postgres}"
    [ -z "$DB_PASS_VAL" ] && DB_PASS_VAL="${PGPASSWORD:-}"

    echo "   Host:  $DB_HOST_VAL:$DB_PORT_VAL"
    echo "   DB:    $DB_NAME_VAL  User: $DB_USER_VAL"

    # Esporta singole variabili Laravel
    export DB_CONNECTION=pgsql
    export DB_HOST="$DB_HOST_VAL"
    export DB_PORT="$DB_PORT_VAL"
    export DB_DATABASE="$DB_NAME_VAL"
    export DB_USERNAME="$DB_USER_VAL"
    export DB_PASSWORD="$DB_PASS_VAL"

    # Aggiorna .env
    sed -i "s|DB_CONNECTION=.*|DB_CONNECTION=pgsql|g" /app/.env 2>/dev/null || true
    for VAR in DB_HOST DB_PORT DB_DATABASE DB_USERNAME DB_PASSWORD; do
        VAL=$(eval echo "\$$VAR")
        grep -q "^${VAR}=" /app/.env 2>/dev/null \
            && sed -i "s|^${VAR}=.*|${VAR}=${VAL}|g" /app/.env \
            || echo "${VAR}=${VAL}" >> /app/.env
    done

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

# ─── 4. Migrazioni ───────────────────────────────────────────────────────────
echo "▶ Migrazioni ($DB_MODE)..."
MIGRATE_OUT=$(php artisan migrate --force --no-interaction 2>&1)
MIGRATE_EXIT=$?
echo "$MIGRATE_OUT"

if [ $MIGRATE_EXIT -ne 0 ]; then
    echo "❌ migrate --force fallito (exit $MIGRATE_EXIT) — crash del container"
    exit 1
fi
echo "✅ Migrate OK"

# ─── 5. Verifica integrità schema (fix schema corrotto) ──────────────────────
# Se migrate dice "Nothing to migrate" ma le tabelle fisiche non esistono,
# eseguiamo migrate:fresh per resettare lo schema corrotto.
if echo "$MIGRATE_OUT" | grep -qi "nothing to migrate"; then
    echo "ℹ️  Nothing to migrate — verifico integrità schema..."

    SCHEMA_OK=$(php -r "
try {
    \$pdo = new PDO(
        'pgsql:host=' . getenv('DB_HOST') . ';port=' . (getenv('DB_PORT') ?: '5432') . ';dbname=' . getenv('DB_DATABASE') . ';sslmode=prefer',
        getenv('DB_USERNAME'),
        getenv('DB_PASSWORD'),
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 5]
    );
    \$s = \$pdo->query(\"SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema='public' AND table_name='personal_access_tokens'\");
    \$r = \$s->fetch(PDO::FETCH_ASSOC);
    echo (\$r && \$r['c'] > 0) ? 'ok' : 'bad';
} catch (Exception \$e) {
    echo 'error:' . \$e->getMessage();
}
" 2>/dev/null || echo "bad")

    echo "   Schema check: $SCHEMA_OK"

    if [ "$SCHEMA_OK" != "ok" ]; then
        echo "⚠️  Schema corrotto rilevato — eseguo migrate:fresh (reset completo)"
        if php artisan migrate:fresh --force --no-interaction 2>&1; then
            echo "✅ migrate:fresh completato — schema ripristinato"
        else
            echo "❌ migrate:fresh fallito — crash del container"
            exit 1
        fi
    else
        echo "✅ Schema integro"
    fi
fi

# ─── 6. Seed (il seeder si auto-protegge con guard idempotente) ──────────────
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
