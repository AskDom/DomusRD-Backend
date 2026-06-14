# DomusRD — Portal Inmobiliario 🏠

Monorepo del proyecto DomusRD: portal inmobiliario para República Dominicana.

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
cd backend
npm install
cp .env.example .env   # configura tu DATABASE_URL y JWT_SECRET
npx prisma migrate dev --name init
npm run dev
```
Corre en `http://localhost:5000`

## Stack

- **Frontend:** React 19, React Router, Tailwind CSS, Framer Motion, React Leaflet
- **Backend:** Express, Prisma ORM, PostgreSQL, JWT, bcrypt
