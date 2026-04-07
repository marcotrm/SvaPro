FROM php:8.3-cli

# Cache busting argument - increment to force fresh build
ARG CACHEBUST=2

# --- System deps + SQLite dev headers ---
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    unzip git curl \
    libzip-dev \
    libonig-dev \
    libsqlite3-dev \
    && docker-php-ext-install pdo_sqlite zip bcmath opcache \
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

# --- Permessi ---
RUN chmod +x start.sh \
    && mkdir -p storage/framework/{cache,sessions,views} storage/logs \
    && chmod -R 775 storage bootstrap/cache

EXPOSE 8000
CMD ["bash", "start.sh"]
