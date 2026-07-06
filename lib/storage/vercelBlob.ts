import { put, del, head } from '@vercel/blob';

/**
 * Storage sobre Vercel Blob. Funciona desde cualquier proceso Node con el
 * token (BLOB_READ_WRITE_TOKEN) — no requiere correr en la infraestructura
 * de Vercel, por eso sirve también desde el worker en EasyPanel.
 */
export class VercelBlobStorage {
  /**
   * Guarda un archivo en Vercel Blob
   */
  async save(buffer: Buffer, filename: string): Promise<string> {
    try {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      const pathname = `planos/${year}/${month}/${day}/${filename}`;

      const result = await put(pathname, buffer, {
        access: 'public',
        contentType: 'application/pdf',
      });

      console.log(`   ✓ Archivo subido a Vercel Blob: ${result.url}`);

      return result.url;
    } catch (error) {
      console.error('Error guardando archivo en Vercel Blob:', error);
      throw new Error(`Error al guardar archivo en Vercel Blob: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Lee un archivo de Vercel Blob (son URLs públicas, se leen por HTTP)
   */
  async read(filepath: string): Promise<Buffer> {
    try {
      const response = await fetch(filepath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('Error leyendo archivo de Vercel Blob:', error);
      throw new Error(`Error al leer archivo de Vercel Blob: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Elimina un archivo de Vercel Blob
   */
  async delete(filepath: string): Promise<void> {
    try {
      await del(filepath);
      console.log(`   ✓ Archivo eliminado de Vercel Blob: ${filepath}`);
    } catch (error) {
      console.error('Error eliminando archivo de Vercel Blob:', error);
      throw new Error(`Error al eliminar archivo de Vercel Blob: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verifica si un archivo existe en Vercel Blob
   */
  async exists(filepath: string): Promise<boolean> {
    try {
      await head(filepath);
      return true;
    } catch {
      return false;
    }
  }
}

// Instancia singleton
export const vercelBlobStorage = new VercelBlobStorage();
