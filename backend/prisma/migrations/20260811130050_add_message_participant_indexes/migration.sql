-- CreateIndex
CREATE INDEX "messages_fromId_idx" ON "messages"("fromId");

-- CreateIndex
CREATE INDEX "messages_toId_idx" ON "messages"("toId");
