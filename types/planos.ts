// Reutilizar del documento arquitectónico principal
export type UTMCoordinate = [number, number];

export interface Colindancia {
  lado: 'norte' | 'sur' | 'este' | 'oeste' | 'frente' | 'fondo' | 'derecha' | 'izquierda'
      | 'NORTE' | 'SUR' | 'ESTE' | 'OESTE' | 'FRENTE' | 'FONDO' | 'DERECHA' | 'IZQUIERDA';
  tipo: 'lote' | 'calle' | 'area_verde' | 'area_comun';
  nombre: string;
  propietario?: string | null;
  longitud?: number | null;
  coordinates?: UTMCoordinate[];
}

export interface Dimensiones {
  frente: number;
  fondo: number;
  ladoDerecho: number;
  ladoIzquierdo: number;
  area: number;
  perimetro: number;
}

export interface Propietario {
  nombre: string;
  dni?: string | null;
  ruc?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
}

export interface LoteMetadata {
  codigo: string;
  nombre: string;
  manzana: string;
  etapa: string;
  numeroLote: string;
  estado: 'libre' | 'separado' | 'vendido';
  precio?: number;
  fechaRegistro?: string;
  // Ubicación detallada (opcional)
  ubicacion?: {
    departamento?: string;
    provincia?: string;
    distrito?: string;
    urbanizacion?: string;
    direccion?: string;
    // Zona UTM (17|18|19, hemisferio sur): Perú completo no cabe en una
    // sola zona. Si se omite, se asume 18 (ver DEFAULT_UTM_ZONE en
    // lib/geometry/utmUtils.ts) — correcto para Lima, incorrecto para
    // proyectos en el extremo norte o sur del país.
    zonaUTM?: number;
  };
}

export interface PlanoConfig {
  incluirMemoriaDescriptiva: boolean;
  incluirPlanoPerimetrico: boolean;
  incluirPlanoUbicacion: boolean;
  formatoPapel?: 'A4' | 'A3' | 'A2' | 'A1' | 'A0' | 'Legal';
  orientacion?: 'portrait' | 'landscape';
  escala?: string;
  incluirColindantesEnPlano: boolean;
  // URL pública (PNG/JPG) del logo a mostrar en el membrete. Si se omite,
  // PlanoRequestAdapter usa el logo por defecto de Akallpa.
  logoUrl?: string;
  formatosPersonalizados?: {
    memoriaDescriptiva?: {
      formato: 'A4' | 'A3' | 'A2' | 'Legal';
      orientacion: 'portrait' | 'landscape';
    };
    planoPerimetrico?: {
      formato: 'A4' | 'A3' | 'A2' | 'Legal';
      orientacion: 'portrait' | 'landscape';
    };
    planoUbicacion?: {
      formato: 'A4' | 'A3' | 'A2' | 'Legal';
      orientacion: 'portrait' | 'landscape';
    };
  };
}

// Payload de la API
export interface GenerarPlanosRequest {
  vertices: UTMCoordinate[];
  dimensiones: Dimensiones;
  lote: LoteMetadata;
  colindancias: Colindancia[];
  propietario?: Propietario;
  config?: Partial<PlanoConfig>;
  contexto?: {
    lotesVecinos?: Array<{
      codigo: string;
      vertices: UTMCoordinate[];
      estado: string;
      tipo?: string;
      texto?: string;
    }>;
    radioBusqueda?: number;
    elementos?: Array<{
      codigo: string;
      vertices: UTMCoordinate[];
      estado: string;
      tipo?: string;
      texto?: string;
    }>;
  };
  imagenContexto?: {
    tipo: string;
    data: string;
  };
}

export interface GenerarPlanosResponse {
  success: boolean;
  data?: {
    planoId: string;
    jobId?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    pdfUrl?: string;
    pdfBase64?: string;
    metadata: {
      loteCodigo: string;
      fechaGeneracion: string;
      documentosIncluidos?: string[];
      tamanoPDF?: number;
      numeroPaginas?: number;
      mensaje?: string;
      estrategiaContexto?: string;
    };
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
