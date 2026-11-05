-- CreateTable
CREATE TABLE "proyectos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "resumen" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantillas_datos" (
    "userId" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plantillas_datos_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "proyectos_userId_updatedAt_idx" ON "proyectos"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantillas_datos" ADD CONSTRAINT "plantillas_datos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

