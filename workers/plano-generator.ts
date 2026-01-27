import { Worker, Job } from 'bullmq';
import { prisma } from '../lib/db/client';
import { PlanoGenerator } from '../lib/generators/PlanoGenerator';
import { storage } from '../lib/storage/client';
import { GenerarPlanoJob } from '../lib/queue/jobs';

// Configuración de conexión a Redis
const redisConnection = {
  host: process.env.REDIS_HOST || '109.123.253.76',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || 'Rafael150185#',
  username: process.env.REDIS_USERNAME || 'default'
};

console.log('🚀 Iniciando Worker de Generación de Planos...');
console.log('📍 Redis:', `${redisConnection.host}:${redisConnection.port}`);

// Crear worker
const worker = new Worker<GenerarPlanoJob>(
  'planos-generation',
  async (job: Job<GenerarPlanoJob>) => {
    const { planoId, vertices, dimensiones, lote, colindancias, config, userId } = job.data;

    console.log(`\n📋 Procesando Job ID: ${job.id}`);
    console.log(`   Plano ID: ${planoId}`);
    console.log(`   Lote: ${lote.codigo}`);
    console.log(`   Usuario: ${userId}`);

    try {
      // 1. Actualizar status a PROCESSING
      await prisma.plano.update({
        where: { id: planoId },
        data: {
          status: 'PROCESSING',
          jobId: job.id
        }
      });

      console.log('   ✓ Status actualizado a PROCESSING');

      // 2. Generar PDF usando PlanoGenerator
      console.log('   🔧 Generando PDF...');
      const generator = new PlanoGenerator({
        vertices,
        dimensiones,
        lote,
        colindancias,
        config
      });

      const pdfBuffer = await generator.generate();
      const pdfSize = pdfBuffer.length;

      console.log(`   ✓ PDF generado: ${(pdfSize / 1024).toFixed(2)} KB`);

      // 3. Guardar PDF en almacenamiento (local o GCS según configuración)
      const filename = `plano_${lote.codigo}_${Date.now()}.pdf`;
      const storageType = storage.getStorageType();
      console.log(`   📦 Guardando en almacenamiento: ${storageType}`);
      
      const pdfUrl = await storage.save(pdfBuffer, filename);

      console.log(`   ✓ PDF guardado: ${pdfUrl}`);

      // 4. Actualizar status a COMPLETED
      await prisma.plano.update({
        where: { id: planoId },
        data: {
          status: 'COMPLETED',
          pdfUrl,
          pdfSize,
          generatedAt: new Date()
        }
      });

      console.log('   ✅ Plano completado exitosamente');

      return {
        success: true,
        planoId,
        pdfUrl,
        pdfSize
      };

    } catch (error) {
      console.error('   ❌ Error en generación:', error);

      // Actualizar status a FAILED con mensaje de error
      await prisma.plano.update({
        where: { id: planoId },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Error desconocido'
        }
      });

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Procesar hasta 5 trabajos en paralelo
    limiter: {
      max: 10, // Máximo 10 trabajos
      duration: 60000 // por minuto
    }
  }
);

// Event handlers
worker.on('completed', (job, result) => {
  console.log(`\n✅ Job ${job.id} completado`);
  console.log(`   Plano ID: ${result.planoId}`);
  console.log(`   PDF URL: ${result.pdfUrl}`);
  console.log(`   Tamaño: ${(result.pdfSize / 1024).toFixed(2)} KB`);
});

worker.on('failed', (job, err) => {
  console.error(`\n❌ Job ${job?.id} falló`);
  console.error(`   Error: ${err.message}`);
});

worker.on('error', (err) => {
  console.error('\n💥 Error en el worker:', err);
});

worker.on('active', (job) => {
  console.log(`\n⚙️ Job ${job.id} activo`);
});

console.log('\n✅ Worker iniciado y escuchando trabajos...');
console.log('   Concurrencia: 5 trabajos en paralelo');
console.log('   Rate limit: 10 trabajos por minuto');
console.log('   Presiona Ctrl+C para detener\n');

// Manejo de señales para cierre graceful
process.on('SIGTERM', async () => {
  console.log('\n⚠️ Recibida señal SIGTERM, cerrando worker...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n⚠️ Recibida señal SIGINT, cerrando worker...');
  await worker.close();
  process.exit(0);
});
