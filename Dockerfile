# Base: PHP 8.3 CLI (leggero, senza Apache)
FROM php:8.3-cli

# --- System dependencies ---
RUN apt-get update && apt-get install -y \
    unzip git curl libzip-dev libonig-dev libxml2-dev \
    && rm -rf /var/lib/apt/lists/*

# --- PHP extensions needed by Laravel ---
RUN docker-php-ext-install pdo pdo_sqlite zip mbstring xml bcmath opcache

# --- Install Node.js 20 ---
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# --- Install Composer ---
COPY --from=composer:2.7 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# --- Copy project files ---
COPY . .

# --- PHP dependencies (production, no dev) ---
RUN composer install --no-dev --optimize-autoloader --no-scripts --no-interaction

# --- Frontend build ---
RUN npm ci --silent && npm run build

# --- Permissions ---
RUN chmod +x start.sh \
    && chmod -R 775 storage bootstrap/cache \
    && mkdir -p storage/framework/{cache,sessions,views} storage/logs

EXPOSE 8000

CMD ["bash", "start.sh"]
