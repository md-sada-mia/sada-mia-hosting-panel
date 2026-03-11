#!/bin/bash
set -e

echo "==================================================="
echo "    Sada Mia Hosting Panel - Installer Script      "
echo "==================================================="

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./install.sh [ip] [port])"
  exit 1
fi

# Ensure we have an .env file for the installer
if [ ! -f .env ]; then
    echo "APP_ENV=production" > .env
    echo "PANEL_PORT=8083" >> .env
    echo "PANEL_IP=" >> .env
    echo "==> Created default .env file."
fi

# Load .env variables
export $(grep -v '^#' .env | xargs)

# Command-line arguments override .env
if [ -n "$1" ]; then
    PANEL_IP=$1
    sed -i "s/^PANEL_IP=.*/PANEL_IP=$1/" .env
fi

if [ -n "$2" ]; then
    PANEL_PORT=$2
    sed -i "s/^PANEL_PORT=.*/PANEL_PORT=$2/" .env
fi

# Determine IP if not provided
if [ -z "$PANEL_IP" ]; then
    if [ "$APP_ENV" = "local" ]; then
        # Get local network IP (usually starts with 192, 172, or 10)
        IP_ADDRESS=$(hostname -I | awk '{print $1}')
    else
        # Get public IP
        IP_ADDRESS=$(curl -s ifconfig.me || echo "YOUR_SERVER_IP")
    fi
else
    IP_ADDRESS=$PANEL_IP
fi

PORT=${PANEL_PORT:-8083}

export DEBIAN_FRONTEND=noninteractive

echo "==> 1. Updating packages"
apt-get update
# Install basic utilities if missing
for pkg in curl wget git unzip sqlite3 libsqlite3-dev; do
    if ! dpkg -s $pkg >/dev/null 2>&1; then
        apt-get install -y $pkg
    fi
done

if ! command -v nginx >/dev/null 2>&1; then
    echo "==> Installing Nginx"
    apt-get install -y nginx
else
    echo "==> Nginx already installed, skipping."
fi

echo "==> 2. Installing PHP 8.4 and Extensions"
if ! command -v php8.4 >/dev/null 2>&1; then
    if ! dpkg -s software-properties-common >/dev/null 2>&1; then
        apt-get install -y software-properties-common
    fi
    add-apt-repository ppa:ondrej/php -y
    apt-get update
    apt-get install -y php8.4 php8.4-fpm php8.4-cli php8.4-sqlite3 php8.4-curl php8.4-mbstring php8.4-xml php8.4-zip php8.4-pgsql php8.4-bcmath php8.4-intl php8.4-gd php8.4-readline redis-server
else
    echo "==> PHP 8.4 already installed."
    # Ensure all extensions are definitely installed even if PHP core is there
    for ext in fpm cli sqlite3 curl mbstring xml zip pgsql bcmath intl gd readline; do
        if ! dpkg -s php8.4-$ext >/dev/null 2>&1; then
            echo "==> Installing missing PHP extension: php8.4-$ext"
            apt-get install -y php8.4-$ext
        fi
    done
    if ! command -v redis-server >/dev/null 2>&1; then
        apt-get install -y redis-server
    fi
fi

echo "==> 3. Installing Composer"
if ! command -v composer >/dev/null 2>&1; then
    curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
else
    echo "==> Composer already installed, skipping."
fi

echo "==> 4. Installing Node.js 20 LTS & PM2"
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "==> Node.js already installed, skipping."
fi

if ! command -v pm2 >/dev/null 2>&1; then
    npm install -g pm2
else
    echo "==> PM2 already installed, skipping."
fi

echo "==> 5. Installing PostgreSQL"
if ! command -v psql >/dev/null 2>&1; then
    apt-get install -y postgresql postgresql-contrib
else
    echo "==> PostgreSQL already installed, skipping."
fi

echo "==> 6. Creating Apps Directory"
APPS_DIR="/var/www/hosting-apps"
mkdir -p $APPS_DIR
chown -R www-data:www-data $APPS_DIR
chmod -R 775 $APPS_DIR
# Set setgid bit so new files inherit the group (www-data)
chmod g+s $APPS_DIR
# Use ACLs if available for better permission inheritance
if command -v setfacl >/dev/null 2>&1; then
    setfacl -R -m d:u:www-data:rwx,d:g:www-data:rwx $APPS_DIR
fi

echo "==> 7. Installing Adminer"
ADMINER_DIR="/var/www/adminer"
mkdir -p $ADMINER_DIR
if [ ! -f "$ADMINER_DIR/index.php" ]; then
    wget -O "$ADMINER_DIR/index.php" https://www.adminer.org/latest-en.php
fi
chown -R www-data:www-data $ADMINER_DIR
chmod -R 755 $ADMINER_DIR

echo "==> 8. Configuring Sudoers for www-data"
sudo_user_name=${SUDO_USER:-$(whoami)}
# Note: Use single quotes for EOF to avoid shell expansion of asterisks and variables
cat > /etc/sudoers.d/sadamiapanel <<'EOF'
www-data ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t
www-data ALL=(ALL) NOPASSWD: /usr/sbin/nginx -s reload
www-data ALL=(ALL) NOPASSWD: /usr/bin/pm2
www-data ALL=(ALL) NOPASSWD: /usr/bin/pm2 *
www-data ALL=(ALL) NOPASSWD: /usr/bin/tee /etc/nginx/sites-available/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/ln -sf /etc/nginx/sites-available/* /etc/nginx/sites-enabled/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/rm -f /etc/nginx/sites-enabled/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/chown -R www-data:www-data /var/www/hosting-apps/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/chmod -R 775 /var/www/hosting-apps/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart nginx
www-data ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart php8.4-fpm
www-data ALL=(ALL) NOPASSWD: /usr/sbin/shutdown -r *
www-data ALL=(postgres) NOPASSWD: /usr/bin/psql -c *
EOF
# Append the sudo user permissions separately to allow variable expansion
echo "$sudo_user_name ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers.d/sadamiapanel
chmod 0440 /etc/sudoers.d/sadamiapanel
chmod 0440 /etc/sudoers.d/sadamiapanel

echo "==> 8. Setting up Panel Backend"
cd backend
composer install --no-interaction --optimize-autoloader
cp .env.example .env || true
php artisan key:generate
# Update APP_URL in backend .env
if [ "$PORT" -eq 80 ]; then
    sed -i "s|^APP_URL=.*|APP_URL=http://$IP_ADDRESS|" .env
    # Add FRONTEND_URL if missing
    grep -q "FRONTEND_URL=" .env || echo "FRONTEND_URL=http://$IP_ADDRESS" >> .env
else
    sed -i "s|^APP_URL=.*|APP_URL=http://$IP_ADDRESS:$PORT|" .env
    # Add FRONTEND_URL if missing
    grep -q "FRONTEND_URL=" .env || echo "FRONTEND_URL=http://$IP_ADDRESS:$PORT" >> .env
fi
# Only publish sanctum migrations if not already present to avoid duplicate errors
if [ -z "$(ls database/migrations/*_create_personal_access_tokens_table.php 2>/dev/null)" ]; then
    php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
fi
php artisan migrate
php artisan db:seed --class=DatabaseSeeder --force
php artisan storage:link || true
php artisan optimize:clear
chown -R www-data:www-data storage bootstrap/cache database
chmod -R 775 storage bootstrap/cache

echo "==> 9. Setting up Panel Frontend"
cd ../frontend
npm install
npm run build
chown -R www-data:www-data dist

echo "==> 9.1 Starting Laravel Queue Worker"
cd ../backend
sudo -u www-data pm2 delete "sada-mia-queue" > /dev/null 2>&1 || true
sudo -u www-data pm2 start php --name "sada-mia-queue" -- artisan queue:work --timeout=600 --tries=3
sudo -u www-data pm2 save
cd ../frontend

echo "==> 10. Configuring Nginx for the Panel"

FRONTEND_DIR="$(pwd)/dist"
cd ../backend
BACKEND_DIR="$(pwd)/public"

cat > /etc/nginx/sites-available/sada-mia-panel <<EOF
server {
    listen $PORT default_server;
    listen [::]:$PORT default_server;
    server_name _;

    root $FRONTEND_DIR;
    index index.html;

    # Frontend SPA routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API Proxy to Laravel
    location ^~ /api {
        alias $BACKEND_DIR;
        try_files \$uri \$uri/ @laravel;
        
        location ~ \.php$ {
            fastcgi_pass unix:/var/run/php/php8.4-fpm.sock;
            fastcgi_index index.php;
            include fastcgi_params;
            fastcgi_param SCRIPT_FILENAME \$request_filename;
        }
    }

    # Adminer
    location /adminer {
        root /var/www;
        index index.php;
        try_files \$uri \$uri/ /adminer/index.php?\$args;

        location ~ \.php$ {
            fastcgi_pass unix:/var/run/php/php8.4-fpm.sock;
            include fastcgi_params;
            fastcgi_param SCRIPT_FILENAME \$request_filename;
        }
    }

    location @laravel {
        fastcgi_pass unix:/var/run/php/php8.4-fpm.sock;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $BACKEND_DIR/index.php;
        fastcgi_param SCRIPT_NAME /index.php;
        fastcgi_param REQUEST_URI \$request_uri;
    }
}
EOF

ln -sf /etc/nginx/sites-available/sada-mia-panel /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && nginx -s reload

echo "==================================================="
echo "  Installation Complete!                           "
if [ "$PORT" -eq 80 ]; then
    echo "  Access panel at: http://$IP_ADDRESS              "
else
    echo "  Access panel at: http://$IP_ADDRESS:$PORT              "
fi
echo "  Default Login:   admin@panel.local               "
echo "  Default Pass:    admin                           "
echo "  Note: Configure domains inside the panel later.  "
echo "  Queue worker is running via PM2: 'pm2 status sada-mia-queue'"
echo "==================================================="
