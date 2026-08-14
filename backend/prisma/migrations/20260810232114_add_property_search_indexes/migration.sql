-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "properties_status_idx" ON "properties"("status");

-- CreateIndex
CREATE INDEX "properties_type_idx" ON "properties"("type");

-- CreateIndex
CREATE INDEX "properties_price_idx" ON "properties"("price");

-- CreateIndex
CREATE INDEX "properties_createdAt_idx" ON "properties"("createdAt");

-- CreateIndex
CREATE INDEX "properties_title_trgm_idx" ON "properties" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "properties_city_trgm_idx" ON "properties" USING GIN ("city" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "properties_sector_trgm_idx" ON "properties" USING GIN ("sector" gin_trgm_ops);
