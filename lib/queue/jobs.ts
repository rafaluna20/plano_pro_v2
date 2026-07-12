import { planosQueue } from './client';
import { GenerarPlanosRequest, UTMCoordinate, Dimensiones, LoteMetadata, Colindancia, Propietario, PlanoConfig } from '@/types/planos';

export interface PlanoJobData {
  planoId: string;
  payload: GenerarPlanosRequest;
}

export interface GenerarPlanoJob {
  planoId: string;
  vertices: UTMCoordinate[];
  // Metadata de lados curvos del polígono principal (ver x_geometry_arcos
  // en Odoo) — sin esto, el worker dibuja el lote como si no tuviera
  // ningún lado curvo, aunque el resto del payload (contexto, con los
  // arcos de elementos urbanos anidados) sí llegue completo.
  arcos?: GenerarPlanosRequest['arcos'];
  dimensiones: Dimensiones;
  lote: LoteMetadata;
  colindancias: Colindancia[];
  propietario?: Propietario;
  contexto?: GenerarPlanosRequest['contexto'];
  imagenContexto?: GenerarPlanosRequest['imagenContexto'];
  config: PlanoConfig;
  userId: string;
}

export async function queuePlanoGeneration(data: GenerarPlanoJob) {
  return await planosQueue.add('generate-plano', data, {
    priority: 1,
    jobId: `plano-${data.planoId}`,
  });
}
