-- Prisma mapea el enum VisitStatus del schema a un tipo nativo de Postgres,
-- pero la primera migración de visitas creó la columna como TEXT. Convertimos
-- la columna al enum real (el default 'PENDIENTE' se conserva).
CREATE TYPE "VisitStatus" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'COMPLETADA');

ALTER TABLE "visits" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "visits" ALTER COLUMN "status" TYPE "VisitStatus" USING "status"::"VisitStatus";
ALTER TABLE "visits" ALTER COLUMN "status" SET DEFAULT 'PENDIENTE'::"VisitStatus";
