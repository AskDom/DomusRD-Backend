# Domify — Portal Inmobiliario 🏠

Monorepo del proyecto Domify: portal inmobiliario para República Dominicana.

## Estructura

```
DomusRD-Backend/
├── frontend/    # React + Tailwind + Framer Motion
└── backend/     # Express + Prisma + PostgreSQL
```

## Frontend

```bash
cd frontend
npm install
npm start
```
Corre en `http://localhost:3000`

## Backend

```bash
# 1. Levanta Postgres (crea domify y domify_test automáticamente)
docker compose up -d

cd backend
npm install
cp .env.example .env
# Si usas el Postgres de docker-compose de arriba, tu DATABASE_URL es:
#   postgresql://domify:domify_dev_password@localhost:5432/domify?schema=public
npx prisma migrate deploy
npm run dev
```
Corre en `http://localhost:5000`

## Tests

```bash
cd backend
cp .env.test.example .env.test   # usa domify_test, ya creada por docker-compose
npm test
```

## Stack

- **Frontend:** React 19, React Router, Tailwind CSS, Framer Motion, React Leaflet
- **Backend:** Express, Prisma ORM, PostgreSQL, JWT, bcrypt
- **Tests:** Jest + Supertest (`backend/tests/`), corridos automáticamente en cada PR vía GitHub Actions
