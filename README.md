# Sada Mia Hosting Panel

A lightweight, self-hosted server management panel designed for Ubuntu Linux. This panel allows you to easily deploy and manage Next.js, Laravel, and Static HTML applications on a single server without using Docker. It provisions apps natively using PM2 for Node.js and PHP-FPM for Laravel.

## 🚀 Features

- **Native Deployment:** Apps run directly on the host OS for maximum performance and lowest RAM overhead.
- **Three App Types Supported:**
  - **Next.js:** Automatic PM2 process management and dynamic port assignment.
  - **Laravel:** PHP 8.3 + PHP-FPM configuration.
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

- Laravel 11 (PHP 8.3)
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

### 2. Run the Installer

Run the installation script. It will automatically detect your server's public IP address:

```bash
sudo ./install.sh
```

The script will automatically:

1. Install PHP 8.3, Nginx, SQLite, and PostgreSQL.
2. Install Node.js 20 and PM2 globally.
3. Configure `sudoers` rules to allow the panel to safely reload Nginx and manage PM2 without a password.
4. Scaffold the Laravel API and React frontend.
5. Setup the Nginx configuration to serve the panel on your server's default IP address.

### 3. Log In

Once finished, go to `http://<YOUR_SERVER_IP>` in your browser.

- **Default Email:** `admin@panel.local`
- **Default Password:** `admin`

_(You can change these in the Settings tab immediately after logging in)._

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
