FROM php:8.3-cli

# --- System deps (libsqlite3-dev serve per pdo_sqlite) ---
RUN apt-get update && apt-get install -y \
    unzip git curl \
    libzip-dev libonig-dev \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# --- PHP extensions ---
# pdo è già nel base image, non va reinstallato
# pdo_sqlite richiede libsqlite3-dev
RUN docker-php-ext-install pdo_sqlite zip bcmath opcache

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
RUN npm ci --silent && npm run build

# --- Permessi ---
RUN chmod +x start.sh \
    && mkdir -p storage/framework/{cache,sessions,views} storage/logs \
    && chmod -R 775 storage bootstrap/cache

EXPOSE 8000
CMD ["bash", "start.sh"]
