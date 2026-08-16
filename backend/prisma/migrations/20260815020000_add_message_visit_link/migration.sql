-- Vincular mensajes de DM con la solicitud de visita que representan
-- (Message.visitId -> visits.id), para poder pintar estado y acciones de la
-- cita directo en el hilo de mensajería.
ALTER TABLE "messages" ADD COLUMN "visitId" TEXT;

ALTER TABLE "messages" ADD CONSTRAINT "messages_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "messages_visitId_idx" ON "messages"("visitId");
