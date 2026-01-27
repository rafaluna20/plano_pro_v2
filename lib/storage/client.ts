import { localStorage as localStorageClient } from './local';
import { gcsStorage } from './gcs';

type StorageType = 'local' | 'gcs';

export class StorageClient {
  private storageType: StorageType;

  constructor() {
    this.storageType = (process.env.STORAGE_TYPE as StorageType) || 'local';
  }

  /**
   * Guarda un archivo usando el proveedor configurado
   */
  async save(buffer: Buffer, filename: string): Promise<string> {
    if (this.storageType === 'gcs') {
      return await gcsStorage.save(buffer, filename);
    }
    return await localStorageClient.save(buffer, filename);
  }

  /**
   * Lee un archivo del almacenamiento
   */
  async read(filepath: string): Promise<Buffer> {
    if (this.storageType === 'gcs') {
      return await gcsStorage.read(filepath);
    }
    return await localStorageClient.read(filepath);
  }

  /**
   * Elimina un archivo del almacenamiento
   */
  async delete(filepath: string): Promise<void> {
    if (this.storageType === 'gcs') {
      return await gcsStorage.delete(filepath);
    }
    return await localStorageClient.delete(filepath);
  }

  /**
   * Verifica si un archivo existe
   */
  async exists(filepath: string): Promise<boolean> {
    if (this.storageType === 'gcs') {
      return await gcsStorage.exists(filepath);
    }
    return await localStorageClient.exists(filepath);
  }

  /**
   * Obtiene el tipo de almacenamiento actual
   */
  getStorageType(): StorageType {
    return this.storageType;
  }
}

// Instancia singleton
export const storage = new StorageClient();
