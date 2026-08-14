-- DropIndex
DROP INDEX "properties_createdAt_idx";

-- CreateIndex
CREATE INDEX "properties_createdAt_id_idx" ON "properties"("createdAt", "id");
