# Sada Mia Hosting Panel

A lightweight, self-hosted server management panel designed for Ubuntu Linux. This panel allows you to easily deploy and manage Next.js, Laravel, and Static HTML applications on a single server without using Docker. It provisions apps natively using PM2 for Node.js and PHP-FPM for Laravel.

## 🚀 Features

- **Native Deployment:** Apps run directly on the host OS for maximum performance and lowest RAM overhead.
- **Three App Types Supported:**
  - **Next.js:** Automatic PM2 process management and dynamic port assignment.
  - **Laravel:** PHP 8.4 + PHP-FPM configuration.
  - **Static Sites:** Plain HTML/SPA fallback serving.
- **Automated Builds:** The panel automatically pulls from your Git repository, installs dependencies (`npm` or `composer`), generates a `.env` file, builds the project, and restarts the app.
- **Automatic Nginx Routing:** Generates and activates Nginx server block configurations for each domain automatically.
- **Live Logs:** View real-time trailing logs for PM2 processes and Laravel `storage/logs`.
- **Database Management:** Easily create new PostgreSQL databases and roles with a single click.
- **Server Monitoring:** Live widget showing RAM, CPU, disk usage, and PM2 process counts.

---

## 🛠️ Technology Stack

**Frontend (Admin UI):**

- React 18 (SPA)
- Vite
- Tailwind CSS
- shadcn/ui components
- React Router

**Backend (API & Orchestrator):**

- Laravel 11 (PHP 8.4)
- SQLite (for panel metadata)
- Laravel Sanctum (Token Auth)
- Direct shell execution (`proc_open`) for system operations.

**Server Infrastructure Governed:**

- Nginx (Reverse Proxy & Static Server)
- PM2 (Node.js Process Manager)
- PostgreSQL (Database backend for deployed apps)
- Git (Version Control pulling)

---

## 📥 Installation

The panel comes with a one-click automated bash script designed to be run on a fresh **Ubuntu 22.04 / 24.04** server.

### Prerequisites

- A fresh Ubuntu Server instance.
- Root or `sudo` access via SSH.

### 1. Download the repository

SSH into your server and clone this repository:

```bash
git clone https://github.com/your-username/sada-mia-hosting-panel.git
cd sada-mia-hosting-panel
```

### 2. Configure Environment (Optional)

The installer will automatically generate an `.env` file in the root directory if one doesn't exist. You can pre-create this file to customize the installation behavior:

```env
# panel root .env
APP_ENV=production    # Use "local" to bind to the LAN IP automatically
PANEL_PORT=8083       # Default Nginx port
PANEL_IP=             # Explicit IP to bind to
```

### 3. Run the Installer

Run the installation script. By default, it will auto-detect your server's public IP and run on port `8083`.

_(If you set `APP_ENV=local` in the `.env` file, it will automatically use your local network IP (e.g. `192.168.x.x`) instead of fetching your public IP)._

You can also explicitly pass an IP address and a Port via the command line (which overrides the `.env`):

```bash
chmod +x install.sh

# Option A: Read from .env, or auto-detect public IP and use default port (8083)
sudo ./install.sh

# Option B: Specify IP, use default port (8083)
sudo ./install.sh 192.168.1.100

# Option C: Specify IP and custom port
sudo ./install.sh 192.168.1.100 8080

# Option D: Run with Data Cleanup (Keeps tools, resets apps/data)
sudo ./install.sh --cleanup
```

### 💡 Data Cleanup Mode

Using the `--cleanup` flag allows you to reset the panel without reinstalling foundational software (PHP, Nginx, etc.).

**What gets cleaned up:**

- All deployed apps in `/var/www/hosting-apps/`
- Nginx site configurations (except for the panel itself)
- BIND9 DNS zone files and configurations
- Postfix/Dovecot email accounts and mail data
- System cron jobs for the `www-data` user
- The panel database (reset to original seeded state)

The script will automatically:

1. Install PHP 8.4, Nginx, SQLite, and PostgreSQL.
2. Install Node.js 20 and PM2 globally.
3. Configure `sudoers` rules to allow the panel to safely reload Nginx and manage PM2 without a password.
4. Scaffold the Laravel API and React frontend.
5. Setup the Nginx configuration to serve the panel on your server's default IP address at the port you specified.

### 3. Log In

Once finished, go to `http://<YOUR_SERVER_IP>:<YOUR_PORT>` in your browser.

- **Default Email:** `admin@panel.local`
- **Default Password:** `admin`

_(You can change these in the Settings tab immediately after logging in)._

---

## 🐙 GitHub Integration

Sada Mia Panel supports seamless GitHub integration, allowing you to pick repositories from your account and enable **Auto-Deploy on Push** (via Webhooks).

### 1. Create a GitHub OAuth App

To enable this, you need to create a GitHub OAuth application:

1.  Go to your GitHub **Settings** > **Developer Settings** > **OAuth Apps**.
2.  Click **New OAuth App**.
3.  **Application Name:** `Sada Mia Hosting Panel` (or anything you like).
4.  **Homepage URL:** `http://<YOUR_SERVER_IP>:<PORT>`
5.  **Authorization callback URL:** `http://<YOUR_SERVER_IP>:<PORT>/github/callback` (Required)
6.  Click **Register application**.
7.  Generate a **Client Secret** and copy both the **Client ID** and **Client Secret**.

### 2. Configure in Panel

1.  Log into your Sada Mia Panel.
2.  Go to the **Settings** tab.
3.  Enter your **GitHub Client ID** and **GitHub Client Secret**.
4.  Enter a **Global Webhook Secret** (a random string of your choice). This is used by GitHub to sign push events so the panel knows they are legitimate.
5.  Click **Save Settings**.
6.  Click **Connect GitHub** to authorize the panel.

Once connected, you will see a repository picker when creating new apps, and you can toggle "Auto Deploy on Push" for any GitHub-linked application!

---

## 💻 Local Development

If you are modifying the panel itself on your local machine, you can use the provided development script.

```bash
chmod +x start.sh
./start.sh
```

This will concurrently boot:

- The Laravel API at `http://localhost:8000`
- The Vite React server at `http://localhost:5173`

_(Note: Features like Nginx reloading, PM2 launching, or Postgres provisioning will likely fail on a local Mac/Windows machine unless you replicate the exact Ubuntu file structure and sudo permissions)._

---

## 📂 Project Structure

- `/backend/` - The Laravel API. Contains all orchestration logic under `app/Services/`.
  - `app/Services/DeploymentService.php` - The core deployment pipeline.
  - `resources/nginx-templates/` - Nginx configuration stubs.
- `/frontend/` - The React application.
- `install.sh` - The Ubuntu setup script.
- `start.sh` - Local dev server boot script.
