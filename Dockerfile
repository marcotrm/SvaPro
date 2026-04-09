FROM dunglas/frankenphp:1-php8.3

# --- PHP extensions ---
RUN install-php-extensions pdo_sqlite pdo_pgsql zip bcmath opcache intl

# --- Node.js 20 + system tools ---
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    git unzip curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# --- Composer ---
COPY --from=composer:2.7 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY . .

# --- PHP deps (no-dev, ottimizzato) ---
RUN composer install --no-dev --optimize-autoloader --no-scripts --no-interaction

# --- Build frontend ---
RUN npm ci && npm run build

# --- Filesystem + .env + key ---
RUN mkdir -p /app/storage/framework/{cache,sessions,views} \
    /app/storage/logs /app/bootstrap/cache \
    /app/database \
    && chmod -R 777 /app/storage /app/bootstrap/cache /app/database \
    && cp /app/.env.railway /app/.env \
    && sed -i 's|DB_DATABASE=.*|DB_DATABASE=/app/storage/database.sqlite|g' /app/.env \
    && touch /app/storage/database.sqlite \
    && chmod 666 /app/storage/database.sqlite \
    && php artisan key:generate --force \
    && echo "=== Build OK ==="

RUN chmod +x start.sh

EXPOSE 8000

CMD ["bash", "start.sh"]
