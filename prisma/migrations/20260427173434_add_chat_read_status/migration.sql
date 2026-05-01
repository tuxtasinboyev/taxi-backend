-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "is_read" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "read_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ChatMessage_chat_id_idx" ON "ChatMessage"("chat_id");

-- CreateIndex
CREATE INDEX "ChatMessage_sender_id_idx" ON "ChatMessage"("sender_id");

-- CreateIndex
CREATE INDEX "ChatMessage_is_read_idx" ON "ChatMessage"("is_read");
