# monorepo-deploy

A Bun + Turborepo monorepo with three apps (a Next.js frontend, an Express REST API, and a WebSocket server) sharing one Postgres database through Prisma 8. Each app is built into its own Docker image and deployed to an EC2 VM by GitHub Actions on every push to `main`.

## Architecture

```
                 ┌───────────────┐
 Browser ──────▶ │ frontend :3000│──┐
   │             └───────────────┘  │
   │             ┌───────────────┐  │     ┌──────────┐
   ├───────────▶ │ backend  :3001│──┼───▶ │ Postgres │
   │             └───────────────┘  │     └──────────┘
   │             ┌───────────────┐  │
   └═══════════▶ │ ws       :8081│──┘
                 └───────────────┘
```

| App | Path | Port | What it does |
|---|---|---|---|
| frontend | `apps/web` | 3000 | Next.js page that renders users server-side |
| backend | `apps/backend` | 3001 | Express API: `GET /users`, `POST /user` |
| ws | `apps/ws` | 8081 | Bun WebSocket server: creates a user per message, echoes it back |

All three import the same database client from the shared `db` package.

## Tech stack

- **Runtime and package manager:** Bun 1.4.2
- **Monorepo:** Turborepo with Bun workspaces
- **Database:** PostgreSQL 18, accessed with Prisma 8 (`@prisma/orm-postgres`)
- **Containers:** Docker, Docker Compose
- **CI/CD:** GitHub Actions → Docker Hub → EC2 over SSH

## Repository layout

```
apps/
  backend/            Express API
  web/                Next.js frontend
  ws/                 WebSocket server
packages/
  db/                 Prisma schema, migrations, and the shared `db` client
  ui/                 Shared React components
  eslint-config/
  typescript-config/
docker/
  Dockerfile.backend
  Dockerfile.frontend
  Dockerfile.ws
.github/workflows/    One deploy workflow per app
docker-compose.yml    Full stack locally: Postgres + migrations + all three apps
```

## Running locally

**Prerequisites:** Bun 1.4.2 and Docker. The repo pins Bun as its package manager, so use `bun` and `bunx`, not `npm` and `npx`.

1. Install dependencies:
   ```bash
   bun install
   ```
2. Start Postgres:
   ```bash
   docker run -d --name postgres -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 postgres:18
   ```
3. Create a `.env` file in `packages/db`, `apps/backend`, `apps/ws`, and `apps/web`, each containing:
   ```
   DATABASE_URL="postgresql://postgres:mysecretpassword@localhost:5432/postgres"
   ```
   Every app needs its own copy, because `.env` is read from the directory the app runs in.
4. Apply migrations:
   ```bash
   cd packages/db && bunx prisma db migrate && cd ../..
   ```
5. Start all three apps:
   ```bash
   bun run dev
   ```

### Running the full stack with Docker Compose

```bash
docker compose up --build
```

This starts Postgres, runs migrations once in a `migrate` container, then starts the three apps on the same ports as above. Use `docker compose down -v` to stop everything and delete the database volume.

## Changing the database schema

The database client uses the Prisma 8 API, which differs from earlier Prisma versions:

```ts
import { db } from "db";

await db.orm.public.User.all();
await db.orm.public.User.create({ username, password });
```

To change the schema:

1. Edit `packages/db/prisma/schema.prisma`. The file must start with `// use prisma-8`.
2. Regenerate the client types, then plan a migration:
   ```bash
   cd packages/db
   bunx prisma contract emit
   bunx prisma migration plan --name <describe-the-change>
   ```
3. Review the generated folder under `packages/db/migrations/`, and commit it together with `schema.prisma`, `schema.json`, and `schema.d.ts`.

Migrations are planned on a developer machine and committed. They're only applied at deploy time, never planned there.

## Deployment

### How it works

Each app has its own workflow in `.github/workflows/`. On a push to `main`, a workflow runs only if files that app depends on changed. Each run then:

1. Builds the app's image from its Dockerfile.
2. Pushes it to Docker Hub, tagged `latest` and with the commit SHA.
3. SSHes into the VM, pulls the SHA-tagged image, and replaces the running container.

The backend workflow also runs `prisma db migrate` on the VM before starting the new container. If the migration fails, the old backend keeps running.

### GitHub secrets

| Secret | Value |
|---|---|
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_PASSWORD` | Docker Hub access token with Read & Write permission |
| `SSH_PRIVATE_KEY` | Private key for the VM. Set it with `gh secret set SSH_PRIVATE_KEY < key.pem` |
| `VM_HOST` | Public IP of the VM |
| `VM_USER` | SSH user, e.g. `ubuntu` on an Ubuntu EC2 instance |

### One-time VM setup (Ubuntu)

```bash
sudo apt-get update && sudo apt-get install -y docker.io
sudo systemctl enable --now docker
sudo usermod -aG docker $USER        # then log out and back in

docker run -d --name postgres --restart unless-stopped \
  -e POSTGRES_PASSWORD=<password> \
  -v pgdata:/var/lib/postgresql \
  -p 5432:5432 postgres:18

echo 'DATABASE_URL=postgresql://postgres:<password>@172.17.0.1:5432/postgres' > ~/app.env
```

`172.17.0.1` is the address containers use to reach the VM itself. If the Docker Hub repositories are private, also run `docker login` on the VM.

**Security group inbound rules:** allow TCP 22 (SSH, used by GitHub Actions), 3000, 3001, and 8081. Don't open 5432.
