FROM php:8.3-cli

# --- System deps + SQLite dev headers + PostgreSQL ---
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    unzip git curl \
    libzip-dev libonig-dev \
    libsqlite3-dev \
    libpq-dev \
    && docker-php-ext-install pdo_sqlite pdo_pgsql zip bcmath opcache \
    && rm -rf /var/lib/apt/lists/*

# --- Node.js 20 ---
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# --- Composer ---
COPY --from=composer:2.7 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY . .

# --- PHP deps ---
RUN composer install --no-dev --optimize-autoloader --no-scripts --no-interaction

# --- Build frontend ---
RUN npm ci && npm run build

# --- Setup filesystem (NO DB migration at build time — il volume non è montato) ---
RUN mkdir -p /app/storage/framework/{cache,sessions,views} \
    /app/storage/logs /app/bootstrap/cache \
    /app/database \
    && chmod -R 777 /app/storage /app/bootstrap/cache /app/database \
    && cp /app/.env.railway /app/.env \
    && php artisan key:generate --force \
    && echo "=== Build OK (migrazioni eseguite a runtime in start.sh) ==="

RUN chmod +x start.sh

EXPOSE 8000
CMD ["bash", "start.sh"]
