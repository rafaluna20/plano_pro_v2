import { Storage } from '@google-cloud/storage';
import path from 'path';

export class GoogleCloudStorage {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    // Configurar Google Cloud Storage
    this.bucketName = process.env.GCS_BUCKET_NAME || 'planos-pro-pdfs';

    // Autenticación por archivo de credenciales o Application Default Credentials
    const keyFilename = process.env.GCS_KEY_FILE;
    
    this.storage = new Storage(
      keyFilename ? { keyFilename } : undefined
    );
  }

  /**
   * Guarda un archivo en Google Cloud Storage
   */
  async save(buffer: Buffer, filename: string): Promise<string> {
    try {
      // Crear subdirectorios por fecha para organizar mejor
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      const filepath = `planos/${year}/${month}/${day}/${filename}`;
      
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filepath);

      // Subir el archivo
      await file.save(buffer, {
        metadata: {
          contentType: 'application/pdf',
          cacheControl: 'public, max-age=31536000', // 1 año
        },
        public: true, // Hacer el archivo público
      });

      // Retornar URL pública
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${filepath}`;
      
      console.log(`   ✓ Archivo subido a GCS: ${publicUrl}`);
      
      return publicUrl;

    } catch (error) {
      console.error('Error guardando archivo en GCS:', error);
      throw new Error(`Error al guardar archivo en GCS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Lee un archivo de Google Cloud Storage
   */
  async read(filepath: string): Promise<Buffer> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filepath);

      const [buffer] = await file.download();
      return buffer;

    } catch (error) {
      console.error('Error leyendo archivo de GCS:', error);
      throw new Error(`Error al leer archivo de GCS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Elimina un archivo de Google Cloud Storage
   */
  async delete(filepath: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filepath);

      await file.delete();
      
      console.log(`   ✓ Archivo eliminado de GCS: ${filepath}`);

    } catch (error) {
      console.error('Error eliminando archivo de GCS:', error);
      throw new Error(`Error al eliminar archivo de GCS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verifica si un archivo existe en Google Cloud Storage
   */
  async exists(filepath: string): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filepath);

      const [exists] = await file.exists();
      return exists;

    } catch {
      return false;
    }
  }

  /**
   * Genera una URL firmada temporal para descarga segura
   */
  async getSignedUrl(filepath: string, expiresInMinutes: number = 60): Promise<string> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filepath);

      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresInMinutes * 60 * 1000
      });

      return url;

    } catch (error) {
      console.error('Error generando URL firmada:', error);
      throw new Error(`Error al generar URL firmada: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Instancia singleton
export const gcsStorage = new GoogleCloudStorage();
