# Agent Rules — Sada Mia Hosting Panel

## Project Overview

**Sada Mia Hosting Panel** is a lightweight, self-hosted server management panel for Ubuntu Linux. It enables deployment and management of Next.js, Laravel, and Static HTML applications natively (without Docker), using PM2 for Node.js and PHP-FPM for Laravel, with Nginx as the reverse proxy.

---

## Tech Stack

### Backend

- **Framework:** Laravel 11 (PHP 8.4)
- **Database:** SQLite (panel metadata only — lightweight, file-based)
- **Auth:** Laravel Sanctum (token-based)
- **System Ops:** Direct shell execution via `proc_open` (wrapped in `ShellService`)
- **Key Services:** `DeploymentService`, `NginxConfigService`, `PM2Service`, `DatabaseService`, `DnsService`, `EmailService`, `CronService`, `GitHubService`, `PortAssignmentService`, `ShellService`
- **Models:** `App`, `Domain`, `Deployment`, `Database`, `CronJob`, `DnsRecord`, `EmailDomain`, `EmailAccount`, `EmailAlias`, `EnvVariable`, `Setting`, `User`
- **API Routes:** Defined in `backend/routes/api.php`
- **Controllers:** Located in `backend/app/Http/Controllers/Api/`

### Frontend

- **Framework:** React 18 (SPA), Vite
- **Styling:** Tailwind CSS + shadcn/ui components
- **Routing:** React Router
- **Pages:** `DashboardPage`, `AppsPage`, `AppDetailPage`, `CreateAppPage`, `DomainsPage`, `DatabasesPage`, `CronPage`, `EmailPage`, `SettingsPage`, `LoginPage`, `GitHubCallbackPage`

### Server Infrastructure Managed

- **Nginx** — reverse proxy and static server
- **PM2** — Node.js process manager
- **PostgreSQL** — database backend for deployed applications
- **Git** — version control for pulling app source code
- **Postfix / Dovecot** — email server (SMTP/IMAP)
- **BIND9 / DNS** — DNS record management

---

## Project File Structure

```
/
├── backend/                        # Laravel API (PHP 8.4)
│   ├── app/
│   │   ├── Http/Controllers/Api/  # API controllers
│   │   ├── Models/                # Eloquent models
│   │   ├── Services/              # Core orchestration services
│   │   └── Jobs/                  # Background jobs
│   ├── database/migrations/       # SQLite schema migrations
│   ├── resources/nginx-templates/ # Nginx config stubs
│   └── routes/api.php             # API route definitions
├── frontend/                      # React SPA (Vite)
│   └── src/
│       ├── components/            # Reusable UI components
│       ├── pages/                 # Page-level components
│       └── lib/                   # Utilities/API client
├── install.sh                     # One-click Ubuntu installer
└── start.sh                       # Local dev boot script
```

---

## Development Conventions

### General

- The backend is the **single source of truth** for all system state. The frontend should always read from and write to the API.
- All system-level operations (Nginx reload, PM2 control, shell commands) **must go through the appropriate Service class**, never directly in controllers.
- Shell commands run via `ShellService` — always use this for any `exec`/`proc_open` calls.
- Prefer **short, focused service methods** — each method should do one thing.

### Backend (Laravel)

- Use **SQLite** for all panel-side data (apps, settings, users, cron jobs, DNS records, email accounts, etc.). Do NOT introduce a new database engine.
- Always create **migrations** for new database tables/columns. Never modify the schema directly.
- Follow the existing controller pattern: thin controllers that delegate to services.
- API responses should be consistent JSON: `{ data: ... }` for success, `{ message: ... }` for errors.
- API routes are versioned as `/api/...` — group new routes logically within `api.php`.
- Use **Laravel Sanctum** for any authenticated endpoints. Do not bypass auth middleware on protected routes.
- Env variables for the panel itself live in `backend/.env`. App-level `.env` files are generated dynamically by `DeploymentService`.

### Frontend (React)

- Use **shadcn/ui** components where applicable. Do not add other UI libraries without discussion.
- Tailwind CSS only — no inline styles or separate CSS files unless absolutely necessary.
- All API calls must go through the centralized API client in `src/lib/`.
- Pages handle data fetching and state. Components are presentational and reusable.
- Use **React Router** for navigation — do not use `window.location` redirects.
- Match the existing dark/neutral design aesthetic present across all pages.
- If any feature requires user confirmation (e.g., delete or confirmation dialoge ), the implementation must use the reusable ConfirmationDialog component. Do not implement js/browser native confirmation dialogs.

### Nginx & System Config

- Nginx server block templates live in `backend/resources/nginx-templates/`.
- `NginxConfigService` handles generating, writing, and activating configs.
- Always test Nginx config validity (`nginx -t`) before reloading.
- Port assignments for Next.js apps are managed by `PortAssignmentService` — do not hardcode ports.

### Installation & Scripts

- `install.sh` provisions the full stack on a fresh Ubuntu 22.04/24.04 server.
- `start.sh` is for local development only — it starts both the Laravel API (`:8000`) and Vite dev server (`:5173`).
- The panel itself is served on port `8083` by default (configurable via `.env` or CLI args).

### Installer Update Policy

**`install.sh` must be kept in sync with any development changes that affect a fresh server setup.** After completing a development change, ask: _"Would a fresh install break without this?"_ If yes, update `install.sh`.

Update `install.sh` whenever you make these kinds of changes:

| Change Type                                                                 | What to Update in `install.sh`                           |
| --------------------------------------------------------------------------- | -------------------------------------------------------- |
| New system package required (e.g. `bind9`, `postfix`, `dovecot`)            | Add the `apt-get install` line in the dependency block   |
| New `sudoers` rule needed for `www-data`                                    | Add the rule to the `visudo`/`sudoers.d` section         |
| New system service to enable/start (e.g. `postfix`, `dovecot`)              | Add `systemctl enable` and `systemctl start` calls       |
| New config file written to the server (e.g. Nginx template, Postfix config) | Add the `cat >` or `cp` block in the appropriate section |
| New environment variable required in `backend/.env`                         | Add it to the `.env` scaffold block                      |
| New directory or permission requirement                                     | Add `mkdir -p`, `chown`, or `chmod` as needed            |
| New PHP extension or Composer dependency needed at install time             | Add to the PHP install block or `composer install` step  |

> **Never assume a feature works on fresh installs just because it works in development.** The dev machine may already have packages/configs that a new server will not have.

---

## Key Workflows

### Adding a New Feature (Backend)

1. Create a migration: `php artisan make:migration create_<feature>_table`
2. Create the model: `php artisan make:model <Model>`
3. Create the service: `app/Services/<Feature>Service.php`
4. Create the controller: `app/Http/Controllers/Api/<Feature>Controller.php`
5. Register routes in `routes/api.php`
6. Run migrations: `php artisan migrate`

### Adding a New Feature (Frontend)

1. Create the page in `src/pages/<FeaturePage>.jsx`
2. Register the route in `src/main.jsx`
3. Add navigation link in the sidebar/nav component
4. Implement API calls via `src/lib/`

### Local Development

```bash
chmod +x start.sh
./start.sh
# Backend: http://localhost:8000
# Frontend: http://localhost:5173
```

### Running Migrations

```bash
cd backend
php artisan migrate
```

---

## Important Constraints

- **No Docker** — everything runs natively on the host OS.
- **No new UI libraries** — use shadcn/ui + Tailwind only.
- **No new databases** — SQLite only for panel data, PostgreSQL only for deployed app databases.
- **Security:** Never expose raw shell output to unauthenticated users. Sanitize all user-provided inputs used in shell commands.
- **Sudoers:** The `www-data` user has passwordless sudo for specific commands (Nginx reload, PM2, etc.). Do not expand sudo permissions without updating `install.sh` accordingly.
- **Installer sync:** Any development change that requires a new package, service, sudoers rule, config file, or env variable **must be reflected in `install.sh`** before the feature is considered complete. See the _Installer Update Policy_ section above.
- **GitHub integration** is managed via OAuth. Tokens/secrets are stored in the `settings` table.
