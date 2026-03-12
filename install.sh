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

# Command-line arguments
DO_CLEANUP=false

for arg in "$@"; do
    case $arg in
        --cleanup)
            DO_CLEANUP=true
            shift
            ;;
    esac
done

# Positional arguments override .env
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

# Cleanup function if --cleanup flag is used
perform_cleanup() {
    echo "==> !!! PERFORMING DATA CLEANUP !!!"
    echo "    This will remove all apps, domains, emails, and crons."
    
    # 1. Cleanup Apps
    APPS_DIR="/var/www/hosting-apps"
    if [ -d "$APPS_DIR" ]; then
        echo "==> Cleaning up apps directory: $APPS_DIR"
        rm -rf $APPS_DIR/*
    fi

    # 2. Cleanup Nginx
    echo "==> Cleaning up Nginx configurations"
    # Remove all except panel and default
    find /etc/nginx/sites-available/ -type f ! -name 'sada-mia-panel' ! -name '00-default' -delete
    find /etc/nginx/sites-enabled/ -type l ! -name 'sada-mia-panel' ! -name '00-default' -delete
    
    # 3. Cleanup DNS (BIND9)
    echo "==> Cleaning up BIND9 zones"
    rm -f /etc/bind/zones/*
    echo "" > /etc/bind/named.conf.local
    
    # 4. Cleanup Email (Postfix + Dovecot)
    echo "==> Cleaning up Email data"
    rm -rf /var/mail/vhosts/*
    echo "" > /etc/postfix/virtual_mailbox_domains
    echo "" > /etc/postfix/virtual_mailbox_maps
    echo "" > /etc/postfix/virtual_alias_maps
    postmap /etc/postfix/virtual_mailbox_domains 2>/dev/null || true
    postmap /etc/postfix/virtual_mailbox_maps    2>/dev/null || true
    postmap /etc/postfix/virtual_alias_maps      2>/dev/null || true
    echo "" > /etc/dovecot/users

    # 4a. Cleanup OpenDKIM
    echo "==> Cleaning up OpenDKIM data"
    rm -rf /etc/opendkim/keys/*
    echo "" > /etc/opendkim/KeyTable
    echo "" > /etc/opendkim/SigningTable
    echo "" > /etc/opendkim/TrustedHosts
    
    # 5. Cleanup Crons
    echo "==> Cleaning up crontab for www-data"
    crontab -r -u www-data 2>/dev/null || true
    
    # 6. Reset Database
    echo "==> Resetting database to original state"
    cd backend
    php artisan migrate:fresh --seed --force
    cd ..

    echo "==> Cleanup complete!"
}

if [ "$DO_CLEANUP" = true ]; then
    perform_cleanup
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> 1. Updating packages"
apt-get update
# Install basic utilities if missing
for pkg in curl wget git unzip sqlite3 libsqlite3-dev opendkim opendkim-tools; do
    if ! dpkg -s $pkg >/dev/null 2>&1; then
        apt-get install -y $pkg
    fi
done

if ! command -v nginx >/dev/null 2>&1; then
    echo "==> Installing Nginx"
    apt-get install -y -o Dpkg::Options::="--force-confold" nginx
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
    apt-get install -y -o Dpkg::Options::="--force-confold" php8.4 php8.4-fpm php8.4-cli php8.4-sqlite3 php8.4-curl php8.4-mbstring php8.4-xml php8.4-zip php8.4-pgsql php8.4-bcmath php8.4-intl php8.4-gd php8.4-readline redis-server
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

# Configure PostgreSQL to allow password authentication for local users
PG_VERSION=$(psql --version | grep -oE '[0-9]+' | head -1)
PG_HBA="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"
if [ -f "$PG_HBA" ]; then
    echo "==> Configuring PostgreSQL authentication in $PG_HBA"
    # Allow md5 for all local and loopback connections
    sed -i "s/^local\s\+all\s\+all\s\+peer/local   all             all                                     md5/" "$PG_HBA"
    sed -i "s/^host\s\+all\s\+all\s\+127.0.0.1\/32\s\+scram-sha-256/host    all             all             127.0.0.1\/32            md5/" "$PG_HBA"
    sed -i "s/^host\s\+all\s\+all\s\+::1\/128\/32\s\+scram-sha-256/host    all             all             ::1\/128                 md5/" "$PG_HBA"
    
    # Also ensure password_encryption is md5 for compatibility with older clients/Adminer if needed
    PG_CONF="/etc/postgresql/$PG_VERSION/main/postgresql.conf"
    if [ -f "$PG_CONF" ]; then
        sed -i "s/#password_encryption = scram-sha-256/password_encryption = md5/" "$PG_CONF"
        sed -i "s/password_encryption = scram-sha-256/password_encryption = md5/" "$PG_CONF"
    fi
    
    systemctl restart postgresql
fi

echo "==> 5a. Installing BIND9 (DNS Server)"
if ! command -v named >/dev/null 2>&1; then
    apt-get install -y -o Dpkg::Options::="--force-confold" bind9 bind9utils bind9-doc
    echo "==> BIND9 installed."
else
    echo "==> BIND9 already installed, skipping."
fi

# Create zones directory
mkdir -p /etc/bind/zones
chown -R bind:bind /etc/bind/zones
chmod 755 /etc/bind/zones

# Ensure named.conf.local exists and is writable by bind
touch /etc/bind/named.conf.local
chown bind:bind /etc/bind/named.conf.local
chmod 644 /etc/bind/named.conf.local

# Add basic BIND9 options if named.conf.options doesn't already have dnssec-validation off
if [ -f /etc/bind/named.conf.options ]; then
    if ! grep -q 'dnssec-validation' /etc/bind/named.conf.options; then
        sed -i '/options {/a\\tdnssec-validation auto;\n\tallow-recursion { 127.0.0.1; ::1; };' /etc/bind/named.conf.options
    fi
fi

systemctl enable bind9 2>/dev/null || true
systemctl restart bind9 2>/dev/null || true
echo "==> BIND9 configured. Zone files will be stored in /etc/bind/zones/"

echo "==> 5b. Installing Postfix + Dovecot (Email Server)"
# Create vmail system user/group for mailbox ownership
if ! id vmail >/dev/null 2>&1; then
    groupadd -g 5000 vmail 2>/dev/null || true
    useradd -g vmail -u 5000 vmail -d /var/mail/vhosts -m -s /sbin/nologin 2>/dev/null || true
    echo "==> vmail user/group created (uid/gid 5000)"
fi

# Create mailbox base directory
mkdir -p /var/mail/vhosts
chown vmail:vmail /var/mail/vhosts
chmod 770 /var/mail/vhosts

if ! command -v postfix >/dev/null 2>&1; then
    # Pre-answer debconf so postfix installs non-interactively
    echo "postfix postfix/mailname string $(hostname -f)" | debconf-set-selections
    echo "postfix postfix/main_mailer_type string 'Internet Site'" | debconf-set-selections
    apt-get install -y -o Dpkg::Options::="--force-confold" postfix postfix-pcre
    echo "==> Postfix installed."
else
    echo "==> Postfix already installed, skipping."
fi

if ! command -v dovecot >/dev/null 2>&1 && ! systemctl is-active --quiet dovecot 2>/dev/null; then
    apt-get install -y -o Dpkg::Options::="--force-confold" dovecot-core dovecot-imapd dovecot-pop3d
    echo "==> Dovecot installed."
else
    echo "==> Dovecot already installed, skipping."
fi

# Configure Postfix for virtual mailboxes (only if not already configured)
POSTFIX_CF=/etc/postfix/main.cf
if [ -f "$POSTFIX_CF" ]; then
    echo "==> Configuring Postfix for virtual mailboxes"

    # Create empty virtual map files if missing
    touch /etc/postfix/virtual_mailbox_domains
    touch /etc/postfix/virtual_mailbox_maps
    touch /etc/postfix/virtual_alias_maps
    chown root:postfix /etc/postfix/virtual_mailbox_domains /etc/postfix/virtual_mailbox_maps /etc/postfix/virtual_alias_maps
    chmod 640 /etc/postfix/virtual_mailbox_domains /etc/postfix/virtual_mailbox_maps /etc/postfix/virtual_alias_maps

    # Run postmap to initialize .db files
    postmap /etc/postfix/virtual_mailbox_domains 2>/dev/null || true
    postmap /etc/postfix/virtual_mailbox_maps    2>/dev/null || true
    postmap /etc/postfix/virtual_alias_maps      2>/dev/null || true

    # Inject virtual mailbox config into main.cf (idempotent)
    grep -q 'virtual_mailbox_base' "$POSTFIX_CF" || cat >> "$POSTFIX_CF" <<'POSTFIXEOF'

# --- Virtual Mailbox Configuration (Added by Sada Mia Panel) ---
virtual_mailbox_base = /var/mail/vhosts
virtual_mailbox_domains = hash:/etc/postfix/virtual_mailbox_domains
virtual_mailbox_maps = hash:/etc/postfix/virtual_mailbox_maps
virtual_alias_maps = hash:/etc/postfix/virtual_alias_maps
virtual_minimum_uid = 100
virtual_uid_maps = static:5000
virtual_gid_maps = static:5000
POSTFIXEOF

    systemctl enable postfix 2>/dev/null || true
    systemctl restart postfix 2>/dev/null || true
fi

# Configure Dovecot for flat-file users
DOVECOT_USERS=/etc/dovecot/users
touch "$DOVECOT_USERS"
chown root:dovecot "$DOVECOT_USERS"
chmod 640 "$DOVECOT_USERS"

# Write Dovecot passwd-file auth config (idempotent)
DOVECOT_AUTH=/etc/dovecot/conf.d/10-auth.conf
if [ -f "$DOVECOT_AUTH" ]; then
    # Disable default system auth and enable passwd-file
    sed -i 's/^!include auth-system.conf.ext/!#include auth-system.conf.ext/' "$DOVECOT_AUTH" 2>/dev/null || true
    grep -q 'auth-passwdfile.conf.ext' "$DOVECOT_AUTH" || echo '!include auth-passwdfile.conf.ext' >> "$DOVECOT_AUTH"
fi

# Write Dovecot passwd-file auth backend
cat > /etc/dovecot/conf.d/auth-passwdfile.conf.ext <<'DOVECOTEOF'
passdb {
  driver = passwd-file
  args = scheme=SHA512-CRYPT username_format=%u /etc/dovecot/users
}
userdb {
  driver = passwd-file
  args = username_format=%u /etc/dovecot/users
  default_fields = uid=vmail gid=vmail home=/var/mail/vhosts/%d/%n
}
DOVECOTEOF

# Configure Dovecot mail location
DOVECOT_MAIL=/etc/dovecot/conf.d/10-mail.conf
if [ -f "$DOVECOT_MAIL" ]; then
    sed -i 's|^mail_location.*|mail_location = maildir:/var/mail/vhosts/%d/%n|' "$DOVECOT_MAIL" 2>/dev/null || true
    grep -q 'mail_location = maildir' "$DOVECOT_MAIL" || echo 'mail_location = maildir:/var/mail/vhosts/%d/%n' >> "$DOVECOT_MAIL"
fi

systemctl enable dovecot 2>/dev/null || true
systemctl restart dovecot 2>/dev/null || true

echo "==> 5c. Configuring OpenDKIM"
mkdir -p /etc/opendkim/keys
touch /etc/opendkim/KeyTable /etc/opendkim/SigningTable /etc/opendkim/TrustedHosts
chown -R opendkim:opendkim /etc/opendkim
chmod -R 750 /etc/opendkim

cat > /etc/opendkim.conf <<EOF
Syslog          yes
UMask           002
KeyTable        refile:/etc/opendkim/KeyTable
SigningTable    refile:/etc/opendkim/SigningTable
ExternalIgnoreList  refile:/etc/opendkim/TrustedHosts
InternalHosts       refile:/etc/opendkim/TrustedHosts
Canonicalization    relaxed/simple
Selector        default
Socket          local:/var/spool/postfix/opendkim/opendkim.sock
UserID          opendkim:opendkim
EOF

# Setup socket directory for Postfix integration
mkdir -p /var/spool/postfix/opendkim
chown opendkim:postfix /var/spool/postfix/opendkim
chmod 750 /var/spool/postfix/opendkim
usermod -a -G opendkim postfix
usermod -a -G postfix opendkim

# Postfix milter configuration
postconf -e "milter_protocol = 6"
postconf -e "milter_default_action = accept"
postconf -e "smtpd_milters = unix:opendkim/opendkim.sock"
postconf -e "non_smtpd_milters = unix:opendkim/opendkim.sock"

systemctl enable opendkim 2>/dev/null || true
systemctl restart opendkim 2>/dev/null || true
postfix reload 2>/dev/null || true

echo "==> Postfix + Dovecot + OpenDKIM configured."

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
if [ ! -f "$ADMINER_DIR/adminer.php" ]; then
    wget -O "$ADMINER_DIR/adminer.php" https://www.adminer.org/latest-en.php
fi

# Create wrapper index.php
cat > "$ADMINER_DIR/index.php" <<'EOF'
<?php
function adminer_object() {
    return new class extends Adminer\Adminer {
        function login($login, $password) { return true; }
        function name() { return "Sada Mia Panel - Adminer"; }
    };
}

if (isset($_POST["auth"])) {
    $_POST["driver"] = $_POST["auth"]["driver"] ?? "pgsql";
    $_POST["server"] = $_POST["auth"]["server"] ?? "127.0.0.1";
    $_POST["username"] = $_POST["auth"]["username"];
    $_POST["password"] = $_POST["auth"]["password"];
    $_POST["db"] = $_POST["auth"]["db"];
}

if (file_exists("./adminer.php")) {
    include "./adminer.php";
} else {
    header("HTTP/1.1 500 Internal Server Error");
    echo "adminer.php not found. Please run install.sh again.";
}
EOF

chown -R www-data:www-data $ADMINER_DIR
chmod -R 755 $ADMINER_DIR

echo "==> 8. Configuring Sudoers for www-data"
sudo_user_name=${SUDO_USER:-$(whoami)}
# Create sudoers file with expanded variables. Heredoc with quotes 'EOF' prevents shell expansion.
cat > /etc/sudoers.d/sadamiapanel <<'EOF'
# Nginx
www-data ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t
www-data ALL=(ALL) NOPASSWD: /usr/sbin/nginx -s reload
www-data ALL=(ALL) NOPASSWD: /usr/bin/tee /etc/nginx/sites-available/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/ln -sf /etc/nginx/sites-available/* /etc/nginx/sites-enabled/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/rm -f /etc/nginx/sites-available/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/rm -f /etc/nginx/sites-enabled/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart nginx
www-data ALL=(ALL) NOPASSWD: /usr/bin/systemctl reload nginx
# PM2
www-data ALL=(ALL) NOPASSWD: /usr/bin/pm2
www-data ALL=(ALL) NOPASSWD: /usr/bin/pm2 *
# PHP & Queue
www-data ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart php8.4-fpm
www-data ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart sada-mia-queue
www-data ALL=(ALL) NOPASSWD: /usr/bin/systemctl status sada-mia-queue
# App directory permissions
www-data ALL=(ALL) NOPASSWD: /usr/bin/chown -R www-data.www-data /var/www/hosting-apps/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/chmod -R 775 /var/www/hosting-apps/*
# Server control
www-data ALL=(ALL) NOPASSWD: /usr/sbin/shutdown -r *
# PostgreSQL
www-data ALL=(postgres) NOPASSWD: /usr/bin/psql -c *
# BIND9 / DNS management
www-data ALL=(ALL) NOPASSWD: /usr/bin/mkdir -p /etc/bind/zones
www-data ALL=(ALL) NOPASSWD: /usr/bin/tee /etc/bind/zones/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/tee -a /etc/bind/named.conf.local
www-data ALL=(ALL) NOPASSWD: /usr/bin/tee /etc/bind/named.conf.local
www-data ALL=(ALL) NOPASSWD: /usr/bin/rm -f /etc/bind/zones/*
www-data ALL=(ALL) NOPASSWD: /usr/sbin/named-checkconf
www-data ALL=(ALL) NOPASSWD: /usr/sbin/named-checkzone *
www-data ALL=(ALL) NOPASSWD: /usr/bin/systemctl reload bind9
www-data ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart bind9
www-data ALL=(ALL) NOPASSWD: /usr/bin/grep -q *
www-data ALL=(ALL) NOPASSWD: /usr/bin/perl -i *
# Postfix / Email management
www-data ALL=(ALL) NOPASSWD: /usr/sbin/postmap *
www-data ALL=(ALL) NOPASSWD: /usr/sbin/postfix reload
www-data ALL=(ALL) NOPASSWD: /usr/bin/touch /etc/postfix/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/tee -a /etc/postfix/virtual_mailbox_domains
www-data ALL=(ALL) NOPASSWD: /usr/bin/tee -a /etc/postfix/virtual_mailbox_maps
www-data ALL=(ALL) NOPASSWD: /usr/bin/tee -a /etc/postfix/virtual_alias_maps
www-data ALL=(ALL) NOPASSWD: /usr/bin/sed -i /etc/postfix/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/mkdir -p /var/mail/vhosts/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/chown -R vmail.vmail /var/mail/vhosts/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/rm -rf /var/mail/vhosts/*
# Dovecot / Email account management
www-data ALL=(ALL) NOPASSWD: /usr/bin/touch /etc/dovecot/users
www-data ALL=(ALL) NOPASSWD: /usr/bin/tee -a /etc/dovecot/users
www-data ALL=(ALL) NOPASSWD: /usr/bin/sed -i /etc/dovecot/users
www-data ALL=(ALL) NOPASSWD: /usr/bin/systemctl reload dovecot
www-data ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart dovecot
# OpenDKIM management
www-data ALL=(ALL) NOPASSWD: /usr/bin/opendkim-genkey *
www-data ALL=(ALL) NOPASSWD: /usr/bin/systemctl reload opendkim
www-data ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart opendkim
www-data ALL=(ALL) NOPASSWD: /usr/bin/mkdir -p /etc/opendkim/keys/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/chown -R opendkim.opendkim /etc/opendkim
www-data ALL=(ALL) NOPASSWD: /usr/bin/chmod -R 750 /etc/opendkim
www-data ALL=(ALL) NOPASSWD: /usr/bin/tee /etc/opendkim/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/tee -a /etc/opendkim/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/cat /etc/opendkim/keys/*/default.txt
EOF
# Append the installer user entry separately as it needs variable expansion
echo "$sudo_user_name ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers.d/sadamiapanel
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

# Ensure database and file are owned by www-data for SQLite write access

touch database/database.sqlite
chown www-data:www-data database/database.sqlite
chmod 664 database/database.sqlite



echo "==> 9. Setting up Panel Frontend"
cd ../frontend
npm install
npm run build
chown -R www-data:www-data dist

echo "==> 9.1 Setting up Laravel Queue Worker (Systemd)"
cd ../backend
BACKEND_DIR=$(pwd)
# Stop and delete from PM2 if it was previously there
sudo -u www-data pm2 delete "sada-mia-queue" > /dev/null 2>&1 || true
sudo -u www-data pm2 save > /dev/null 2>&1 || true

# Create Systemd Service
cat > /etc/systemd/system/sada-mia-queue.service <<EOF
[Unit]
Description=Sada Mia Panel Queue Worker
After=network.target postgresql.service redis-server.service

[Service]
User=www-data
Group=www-data
Restart=always
WorkingDirectory=$BACKEND_DIR
ExecStart=/usr/bin/php $BACKEND_DIR/artisan queue:work --timeout=600 --tries=3
StandardOutput=append:$BACKEND_DIR/storage/logs/queue.log
StandardError=append:$BACKEND_DIR/storage/logs/queue.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable sada-mia-queue
systemctl restart sada-mia-queue
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

# Create a default catch-all for port 80 to prevent random apps from acting as the default
if [ "$PORT" -ne 80 ]; then
cat > /etc/nginx/sites-available/00-default <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 404;
}
EOF
ln -sf /etc/nginx/sites-available/00-default /etc/nginx/sites-enabled/
fi

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
echo "  ---------------------------------------------------"
echo "  DNS (BIND9):     /etc/bind/zones/              "
echo "  Email (Postfix): /var/mail/vhosts/              "
echo "  Queue worker:    systemctl status sada-mia-queue"
echo "==================================================="
