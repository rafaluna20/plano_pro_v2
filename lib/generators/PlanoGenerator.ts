import { jsPDF } from 'jspdf';
import { GenerarPlanosRequest, PlanoConfig } from '@/types/planos';
import { MemoriaDescriptivaGenerator } from './MemoriaDescriptiva';
import { PlanoPerimetricoGeneratorV2 } from './PlanoPerimetricoGeneratorV2';
import { PlanoUbicacionGenerator } from './PlanoUbicacion';
import { PlanoRequestAdapter, DEFAULT_LOGO_URL } from './PlanoRequestAdapter';
import { procesarDatosPlano } from '@/lib/services/PlanoDataProcessor';

// Interfaz para estandarizar los generadores hijos
interface IDocumentGenerator {
  generate(pdf: jsPDF): Promise<void>;
}

/**
 * Orquestador Principal de Generación de Planos (Proyecto Terra Lima)
 * * MEJORAS (V2 Integration):
 * - Gestión inteligente de formatos mixtos (A4 para textos, A3 para gráficos).
 * - Detección de estrategia de contexto para metadatos.
 * - Manejo robusto de errores por documento.
 * - Integración con Motor Híbrido V2.
 */
export class PlanoGenerator {
  private config: PlanoConfig;

  constructor(private request: GenerarPlanosRequest) {
    this.config = this.normalizeConfig(request.config);
  }

  /**
   * Centraliza la configuración y aplica reglas de negocio para formatos.
   * Por defecto: Memoria -> A4 Vertical | Planos -> A3 Horizontal
   */
  private normalizeConfig(inputConfig?: Partial<PlanoConfig>): PlanoConfig {
    const baseConfig = {
      incluirMemoriaDescriptiva: true,
      incluirPlanoPerimetrico: true,
      incluirPlanoUbicacion: true,
      incluirColindantesEnPlano: true,
      ...inputConfig,
      // Mismo logo por defecto que ya usan el Plano Perimétrico y el Plano
      // de Ubicación (vía PlanoRequestAdapter.mapConfig), para que la
      // Memoria Descriptiva muestre la misma identidad de marca. Se calcula
      // después del spread para no depender de si inputConfig trae la
      // clave `logoUrl` explícitamente en `undefined`.
      logoUrl: inputConfig?.logoUrl || DEFAULT_LOGO_URL,
    };

    // Definimos los formatos específicos si no vienen en el request
    return {
      ...baseConfig,
      formatosPersonalizados: {
        memoriaDescriptiva: inputConfig?.formatosPersonalizados?.memoriaDescriptiva || {
          formato: 'A4',
          orientacion: 'portrait'
        },
        planoPerimetrico: inputConfig?.formatosPersonalizados?.planoPerimetrico || {
          formato: 'A3', // Estándar para planos municipales
          orientacion: 'landscape'
        },
        planoUbicacion: inputConfig?.formatosPersonalizados?.planoUbicacion || {
          formato: 'A3',
          orientacion: 'landscape'
        },
      },
    } as PlanoConfig;
  }

  /**
   * Ejecuta la generación secuencial del expediente técnico
   */
  async generate(): Promise<Buffer> {
    try {
      // 0. PRE-PROCESAMIENTO V2 (Híbrido)
      // Convertimos el request legacy al payload V2 y procesamos los datos
      const hybridPayload = PlanoRequestAdapter.toHybridPayload(this.request);
      const datosProcesados = await procesarDatosPlano(hybridPayload);

      // 1. Setup Inicial
      // Iniciamos con el formato del primer documento activo para evitar páginas en blanco
      const initialSetup = this.getInitialFormat();

      const pdf = new jsPDF({
        orientation: initialSetup.orientacion as 'portrait' | 'landscape',
        unit: 'mm',
        format: this.getJsPDFFormat(initialSetup.formato),
        compress: true // Optimización de peso de archivo
      });

      // 2. Definir la Cola de Producción
      // El generador de perimétrico se nombra aparte porque PlanoUbicacion
      // necesita leer su escala final (getEscalaUtilizada()) para mantener
      // una proporción visual consistente entre ambos documentos. Como el
      // perimétrico corre antes en la cola, el valor ya está listo para
      // cuando Ubicación lo lee dentro de su propio generate().
      const planoPerimetricoGen = new PlanoPerimetricoGeneratorV2(hybridPayload, datosProcesados);

      const queue: Array<{
        condition: boolean;
        generator: IDocumentGenerator;
        format: { formato: any; orientacion: any };
        name: string;
      }> = [
          {
            condition: !!this.config.incluirMemoriaDescriptiva,
            generator: new MemoriaDescriptivaGenerator(this.request, this.config, datosProcesados),
            format: this.config.formatosPersonalizados!.memoriaDescriptiva as { formato: any; orientacion: any },
            name: 'Memoria Descriptiva'
          },
          {
            condition: !!this.config.incluirPlanoPerimetrico,
            generator: planoPerimetricoGen,
            format: this.config.formatosPersonalizados!.planoPerimetrico as { formato: any; orientacion: any },
            name: 'Plano Perimétrico'
          },
          {
            condition: !!this.config.incluirPlanoUbicacion,
            generator: new PlanoUbicacionGenerator(this.request, this.config, planoPerimetricoGen),
            format: this.config.formatosPersonalizados!.planoUbicacion as { formato: any; orientacion: any },
            name: 'Plano Ubicación'
          }
        ];

      // 3. Ejecución de la Cola
      let pagesAdded = 0;

      for (const task of queue) {
        if (task.condition) {
          // Si ya hay páginas, agregamos una nueva con las dimensiones específicas de esta tarea
          if (pagesAdded > 0) {
            pdf.addPage(
              this.getJsPDFFormat(task.format.formato),
              task.format.orientacion
            );
          }

          // console.log(`Generando documento: ${task.name}...`);
          await task.generator.generate(pdf);
          pagesAdded++;
        }
      }

      // 4. Retorno del PDF compilado
      return Buffer.from(pdf.output('arraybuffer'));

    } catch (error) {
      console.error('CRITICAL ERROR in PlanoGenerator:', error);
      throw new Error(`Fallo crítico generando el expediente: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Determina el formato de la primera página
   */
  private getInitialFormat(): { formato: string; orientacion: 'portrait' | 'landscape' } {
    if (this.config.incluirMemoriaDescriptiva) return this.config.formatosPersonalizados!.memoriaDescriptiva as { formato: string; orientacion: 'portrait' | 'landscape' };
    if (this.config.incluirPlanoPerimetrico) return this.config.formatosPersonalizados!.planoPerimetrico as { formato: string; orientacion: 'portrait' | 'landscape' };
    if (this.config.incluirPlanoUbicacion) return this.config.formatosPersonalizados!.planoUbicacion as { formato: string; orientacion: 'portrait' | 'landscape' };
    return { formato: 'A4', orientacion: 'portrait' };
  }

  /**
   * Conversor de formatos legibles a dimensiones jsPDF
   */
  private getJsPDFFormat(formato: string): string | number[] {
    const formats: Record<string, string | number[]> = {
      'A4': 'a4',
      'A3': 'a3', // 297 x 420 mm
      'A2': [420, 594],
      'A1': [594, 841],
      'A0': [841, 1189],
      'Legal': 'legal',
      'Letter': 'letter'
    };
    return formats[formato] || 'a4';
  }

  /**
   * Genera base64 (útil para previsualización en frontend)
   */
  async generateBase64(): Promise<string> {
    const buffer = await this.generate();
    return buffer.toString('base64');
  }

  /**
   * Retorna metadatos de auditoría sobre la generación
   * Útil para saber qué estrategia de contexto se usó (Vectores vs Imagen)
   */
  getMetadata() {
    // Detectar estrategia usada
    let contextStrategy = 'NONE';
    const elementos = (this.request.contexto as any)?.elementos || (this.request.contexto?.lotesVecinos);
    if (elementos && elementos.length > 0) contextStrategy = 'VECTOR_HIGH_PRECISION';
    else if ((this.request as any).imagenContexto?.data) contextStrategy = 'SNAPSHOT_LEAFLET';
    else contextStrategy = 'MAP_SERVER_FALLBACK';

    return {
      loteCodigo: this.request.lote.codigo,
      timestamp: new Date().toISOString(),
      config: {
        memoria: this.config.incluirMemoriaDescriptiva,
        perimetrico: this.config.incluirPlanoPerimetrico,
        ubicacion: this.config.incluirPlanoUbicacion,
        estrategiaContexto: contextStrategy // Dato valioso para debugging
      },
      version: '2.1.0-terralima (V2 Hybrid Engine)'
    };
  }
}

// Wrapper Helper para uso directo en API Routes
export async function generarPlanos(request: GenerarPlanosRequest) {
  const generator = new PlanoGenerator(request);
  const buffer = await generator.generate();
  return {
    buffer,
    base64: buffer.toString('base64'),
    metadata: generator.getMetadata()
  };
}