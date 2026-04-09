#!/bin/bash
# SvaPro — Container entrypoint
# ATTENZIONE: non usare set -e — gestiamo gli errori esplicitamente

echo "========================================"
echo "  SvaPro — Avvio (PORT: ${PORT:-8000})"
echo "========================================"

# ─── 1. Railway env → .env ───────────────────────────────────────────────────
[ -n "$APP_KEY" ] && sed -i "s|APP_KEY=.*|APP_KEY=$APP_KEY|g" /app/.env 2>/dev/null || true
[ -n "$APP_URL" ] && sed -i "s|APP_URL=.*|APP_URL=$APP_URL|g" /app/.env 2>/dev/null || true

# ─── 2. Seleziona il database ────────────────────────────────────────────────
if [ -n "$DATABASE_URL" ]; then
    echo "✅ PostgreSQL: DATABASE_URL trovato"

    # Forza pgsql sovrascrivendo qualsiasi variabile conflittuale
    export DB_CONNECTION=pgsql
    export DB_URL="$DATABASE_URL"
    unset DB_DATABASE

    # Aggiorna .env per ogni processo figlio
    sed -i "s|DB_CONNECTION=.*|DB_CONNECTION=pgsql|g" /app/.env 2>/dev/null || true
    grep -q "^DATABASE_URL=" /app/.env 2>/dev/null \
        && sed -i "s|DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|g" /app/.env \
        || echo "DATABASE_URL=$DATABASE_URL" >> /app/.env

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

# ─── 3. Ricrea config cache con le variabili corrette ────────────────────────
php artisan config:clear --no-interaction 2>/dev/null || true
php artisan config:cache --no-interaction 2>/dev/null || true

# ─── 4. Migrazioni ───────────────────────────────────────────────────────────
echo "▶ php artisan migrate ($DB_MODE)..."
if php artisan migrate --force --no-interaction 2>&1; then
    echo "✅ Migrate OK"
else
    echo "❌ Migrate FALLITO — i dettagli dell'errore sono sopra"
    echo "   L'app partirà comunque ma potrebbe non funzionare correttamente"
fi

# ─── 5. Seed (il seeder ha un guard idempotente — sicuro chiamarlo sempre) ───
echo "▶ php artisan db:seed..."
if php artisan db:seed --force --no-interaction 2>&1; then
    echo "✅ Seed OK (o già eseguito in precedenza)"
else
    echo "⚠️  Seed fallito o già presente — l'app continua comunque"
fi

# ─── 6. Storage link ─────────────────────────────────────────────────────────
php artisan storage:link --force 2>/dev/null || true

echo ""
echo "========================================"
echo "  🚀 Server: 0.0.0.0:${PORT:-8000}"
echo "========================================"

exec php artisan serve --host=0.0.0.0 --port="${PORT:-8000}"
