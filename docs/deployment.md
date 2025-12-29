# Deployment

## Local development

```bash
npm install
npm run db:migrate   # generate/migrate the SQLite schema
npm run dev
```

Visiting `http://localhost:3000` loads the dashboard. The sidebar highlights the restart banner whenever the stored port diverges from the current process port.

## Building for production

```bash
npm run db:migrate
npm run build
npm run start
```

The job runner bootstraps automatically inside `RootLayout`. Ensure the process is long-lived (PM2, systemd, Docker) so the timers stay active.

## Docker Compose (example)

```yaml
services:
  ebr:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./var/data:/app/var/data
      - ./downloads:/app/var/downloads
      - ./library:/app/var/library
    environment:
      - DATABASE_PATH=/app/var/data/ebr.sqlite
      - DOWNLOADS_DIR=/app/var/downloads
      - LIBRARY_ROOT=/app/var/library
```

- Mount downloads + library directories so SABnzbd/NZBGet and the importer see the same filesystem.
- Port binding is still managed by your orchestrator. Updating the UI port requires restarting the container with the new mapping.

## Health checks

- `GET /api/health` returns `{ database: "ok", jobRunner: "running" }` when the database is reachable and the worker loop is active.
- Disable any external load balancer health check caching because this endpoint hits the database every time.
