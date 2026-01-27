-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER', 'API_CLIENT');

-- CreateEnum
CREATE TYPE "PlanoStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissions" TEXT[],
    "rateLimit" INTEGER NOT NULL DEFAULT 100,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos" (
    "id" TEXT NOT NULL,
    "loteCodigo" TEXT NOT NULL,
    "loteNombre" TEXT NOT NULL,
    "manzana" TEXT NOT NULL,
    "etapa" TEXT NOT NULL,
    "numeroLote" TEXT NOT NULL,
    "vertices" JSONB NOT NULL,
    "dimensiones" JSONB NOT NULL,
    "colindancias" JSONB NOT NULL,
    "propietario" JSONB,
    "pdfUrl" TEXT,
    "pdfSize" INTEGER,
    "thumbnailUrl" TEXT,
    "status" "PlanoStatus" NOT NULL DEFAULT 'PENDING',
    "jobId" TEXT,
    "errorMessage" TEXT,
    "config" JSONB NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'api',
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_logs" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestBody" JSONB,
    "responseBody" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");

-- CreateIndex
CREATE INDEX "planos_loteCodigo_idx" ON "planos"("loteCodigo");

-- CreateIndex
CREATE INDEX "planos_userId_idx" ON "planos"("userId");

-- CreateIndex
CREATE INDEX "planos_status_idx" ON "planos"("status");

-- CreateIndex
CREATE INDEX "planos_createdAt_idx" ON "planos"("createdAt");

-- CreateIndex
CREATE INDEX "api_logs_apiKeyId_idx" ON "api_logs"("apiKeyId");

-- CreateIndex
CREATE INDEX "api_logs_createdAt_idx" ON "api_logs"("createdAt");

-- CreateIndex
CREATE INDEX "api_logs_endpoint_idx" ON "api_logs"("endpoint");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos" ADD CONSTRAINT "planos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
