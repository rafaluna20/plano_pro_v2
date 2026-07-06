import { GenerarPlanoJob } from '@/lib/queue/jobs';

/**
 * Cliente HTTP para el microservicio Python de exportación DXF
 * (services/dxf-service). Es opcional: si DXF_SERVICE_URL no está
 * configurada, el flujo de generación de PDF sigue funcionando igual,
 * simplemente no se produce el archivo DXF.
 */

export function isDxfServiceConfigured(): boolean {
  return !!process.env.DXF_SERVICE_URL;
}

interface GenerateDxfInput {
  vertices: GenerarPlanoJob['vertices'];
  lote: GenerarPlanoJob['lote'];
  colindancias: GenerarPlanoJob['colindancias'];
  contextoElementos?: Array<{
    tipo?: string;
    codigo?: string;
    texto?: string;
    vertices: GenerarPlanoJob['vertices'];
  }>;
}

export async function generateDxf(input: GenerateDxfInput): Promise<Buffer> {
  const baseUrl = process.env.DXF_SERVICE_URL;
  if (!baseUrl) {
    throw new Error('DXF_SERVICE_URL no está configurada');
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/generate-dxf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vertices: input.vertices,
      lote: input.lote,
      colindancias: input.colindancias,
      contexto_elementos: input.contextoElementos ?? [],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Servicio DXF respondió ${response.status}: ${detail}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
