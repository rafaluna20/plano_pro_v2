-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN "keyHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");
