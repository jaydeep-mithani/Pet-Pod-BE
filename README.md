# Pet-Pod-BE

NestJS backend for Pet Pod — auth, pet listings, conversations.

## Local setup

You need Node 20+, npm, and a Postgres connection string.

### 1. Get a free Postgres database

Sign up at [Neon](https://console.neon.tech/), create a project, and copy the connection string. It looks like:
`postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require`

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in:
- `DATABASE_URL` — the Neon connection string from step 1
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` — generate with `openssl rand -hex 32` (run twice, paste different values)

The default `PORT=4000` works for local dev. If you change it, also update `NEXT_PUBLIC_API_BASE_URL` in `Pet-Pod-FE/.env.local` to match.

### 3. Install + migrate

```bash
npm install
npx prisma migrate dev --name init
```

This creates tables in your Neon database and generates the Prisma client.

### 4. Run

```bash
npm run start:dev
```

API runs on http://localhost:4000.

## Auth flow

JWT in HTTP-only cookies (`pp_access`, `pp_refresh`). The refresh token cookie is path-scoped to `/auth` so it's only sent on refresh/logout calls.

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /auth/signup` | none | Create account, sets cookies |
| `POST /auth/login` | none | Sets cookies |
| `POST /auth/refresh` | refresh cookie | Rotates the refresh token, issues new access |
| `POST /auth/logout` | access cookie | Revokes refresh token, clears cookies |
| `GET /users/me` | access cookie | Returns current user profile |

Refresh tokens are hashed (sha256) before storage in the `RefreshToken` table. On rotation, the old one is marked revoked.

### Quick smoke test

```bash
# Signup
curl -i -X POST http://localhost:4000/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"hunter22!","name":"Test User"}' \
  -c /tmp/pp-cookies.txt

# Get current user
curl -i http://localhost:4000/users/me -b /tmp/pp-cookies.txt
```

## Module layout

```
src/
  prisma/          Shared PrismaService (global module)
  auth/            Signup, login, refresh, logout, JWT strategies, guards
  users/           /users/me + user profile queries
  app.module.ts    Wires everything
  main.ts          Bootstrap: CORS, cookie parser, validation pipe
```

Future modules (Phases 4 + 5): `pets/`, `conversations/`.

## Common commands

```bash
npm run start:dev          # dev server with watch
npm run build              # production build to dist/
npm run lint               # ESLint
npx prisma migrate dev     # apply schema changes locally
npx prisma studio          # open the DB browser
npx prisma generate        # regenerate the client (rarely needed manually)
```
