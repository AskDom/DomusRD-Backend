-- Recupera el drift entre schema.prisma y las migraciones: "cedula" existía en
-- las bases de dev/test (llegó vía `prisma db push`) pero no en ninguna
-- migración, así que un deploy limpio con `migrate deploy` levantaba una base
-- sin la columna y login/registro respondían 500 (P2022: column does not
-- exist). Idempotente a propósito — IF NOT EXISTS permite aplicarla también
-- sobre bases que ya tienen la columna (dev/test) sin fallar.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cedula" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_cedula_key" ON "users"("cedula");
