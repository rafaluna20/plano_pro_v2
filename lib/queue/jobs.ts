import { planosQueue } from './client';
import { GenerarPlanosRequest, UTMCoordinate, Dimensiones, LoteMetadata, Colindancia, PlanoConfig } from '@/types/planos';

export interface PlanoJobData {
  planoId: string;
  payload: GenerarPlanosRequest;
}

export interface GenerarPlanoJob {
  planoId: string;
  vertices: UTMCoordinate[];
  dimensiones: Dimensiones;
  lote: LoteMetadata;
  colindancias: Colindancia[];
  config: PlanoConfig;
  userId: string;
}

export async function queuePlanoGeneration(data: GenerarPlanoJob) {
  return await planosQueue.add('generate-plano', data, {
    priority: 1,
    jobId: `plano-${data.planoId}`,
  });
}
