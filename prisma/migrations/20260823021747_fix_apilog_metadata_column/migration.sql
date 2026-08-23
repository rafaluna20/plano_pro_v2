-- AlterTable
ALTER TABLE "api_logs" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "planos" ADD COLUMN     "contexto" JSONB;
