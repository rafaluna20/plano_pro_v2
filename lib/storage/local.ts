import fs from 'fs/promises';
import path from 'path';

export class LocalStorage {
  private basePath: string;

  constructor(basePath: string = './public/uploads') {
    this.basePath = basePath;
  }

  /**
   * Guarda un archivo en el sistema de archivos local
   */
  async save(buffer: Buffer, filename: string): Promise<string> {
    try {
      // Asegurar que el directorio existe
      await fs.mkdir(this.basePath, { recursive: true });

      // Crear subdirectorios por fecha para organizar mejor
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      const subdir = path.join(this.basePath, String(year), month, day);
      await fs.mkdir(subdir, { recursive: true });

      // Guardar el archivo
      const filePath = path.join(subdir, filename);
      await fs.writeFile(filePath, buffer);

      // Construir URL pública relativa (debe empezar con / y NO incluir /public/)
      let publicPath = filePath
        .replace(/\\/g, '/')           // Cambiar \ por /
        .replace(/^\.\/public/, '')    // Remover ./public del inicio
        .replace(/^public/, '');       // Remover public del inicio si no tiene ./
      
      if (!publicPath.startsWith('/')) {
        publicPath = '/' + publicPath;
      }
      
      console.log(`   ✓ Archivo guardado localmente: ${filePath}`);
      console.log(`   ✓ URL pública: ${publicPath}`);
      
      return publicPath;

    } catch (error) {
      console.error('Error guardando archivo:', error);
      throw new Error(`Error al guardar archivo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Lee un archivo del sistema de archivos local
   */
  async read(filepath: string): Promise<Buffer> {
    try {
      const fullPath = path.join('./public', filepath);
      return await fs.readFile(fullPath);
    } catch (error) {
      console.error('Error leyendo archivo:', error);
      throw new Error(`Error al leer archivo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Elimina un archivo del sistema de archivos local
   */
  async delete(filepath: string): Promise<void> {
    try {
      const fullPath = path.join('./public', filepath);
      await fs.unlink(fullPath);
    } catch (error) {
      console.error('Error eliminando archivo:', error);
      throw new Error(`Error al eliminar archivo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verifica si un archivo existe
   */
  async exists(filepath: string): Promise<boolean> {
    try {
      const fullPath = path.join('./public', filepath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}

// Instancia singleton
export const localStorage = new LocalStorage();
