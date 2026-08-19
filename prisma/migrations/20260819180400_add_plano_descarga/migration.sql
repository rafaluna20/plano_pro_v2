-- CreateTable
CREATE TABLE "plano_descargas" (
    "id" TEXT NOT NULL,
    "loteCodigo" TEXT NOT NULL,
    "staffUid" INTEGER,
    "staffNombre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plano_descargas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plano_descargas_loteCodigo_idx" ON "plano_descargas"("loteCodigo");

-- CreateIndex
CREATE INDEX "plano_descargas_staffUid_idx" ON "plano_descargas"("staffUid");

-- CreateIndex
CREATE INDEX "plano_descargas_createdAt_idx" ON "plano_descargas"("createdAt");
