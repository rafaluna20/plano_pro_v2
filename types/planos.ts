// Reutilizar del documento arquitectónico principal
export type UTMCoordinate = [number, number];

export interface Colindancia {
  lado: 'norte' | 'sur' | 'este' | 'oeste' | 'frente' | 'fondo' | 'derecha' | 'izquierda'
      | 'NORTE' | 'SUR' | 'ESTE' | 'OESTE' | 'FRENTE' | 'FONDO' | 'DERECHA' | 'IZQUIERDA';
  /** "lote" o el código de capa dinámico del elemento urbano (ver elemento.urbano.capa en Odoo). */
  tipo: string;
  nombre: string;
  propietario?: string | null;
  longitud?: number | null;
  coordinates?: UTMCoordinate[];
  /** Presentes solo si este lindero es un arco de circunferencia (ver ArcoMetadata). */
  radio?: number | null;
  longitudArco?: number | null;
  sentido?: 'horario' | 'antihorario' | null;
}

/** Metadata de un lado curvo del polígono principal (ver x_geometry_arcos en Odoo). */
export interface ArcoMetadata {
  indiceVertice: number;
  radio: number;
  longitudArco: number;
  sentido: 'horario' | 'antihorario';
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
  /** Metadata de lados curvos del polígono principal (ver x_geometry_arcos en Odoo). */
  arcos?: ArcoMetadata[];
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
      /** Color hex de la capa (elemento.urbano.capa en Odoo). Dinámico, no un enum fijo. */
      color?: string;
      /** Si el nombre del elemento se imprime como etiqueta sobre el polígono. */
      mostrarEtiqueta?: boolean;
      /** Si la capa es área (polígono relleno) o línea (trazo abierto, sin relleno). Default true. */
      esArea?: boolean;
      /** Solo aplica si esArea=true: dibuja el polígono cerrado sin color de relleno, solo el borde. */
      sinRelleno?: boolean;
      /** Solo aplica si esArea=true: opuesto a sinRelleno — dibuja el relleno sin trazo de contorno. */
      sinBorde?: boolean;
      /** Lados curvos del polígono (vertices), si el elemento tiene alguno. */
      arcos?: ArcoMetadata[];
      /** Presente solo si el elemento es un círculo completo (reemplaza a "vertices"). */
      circulo?: { centro: UTMCoordinate; radio: number };
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
