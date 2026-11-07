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
  // Del PROYECTO del lote (P5/P7 multiproyecto). Todos opcionales: sin ellos el documento sale como siempre.
  /** Nombre del proyecto: lo que se imprime donde antes decía «TERRA LIMA» fijo. */
  proyectoNombre?: string;
  /** Cómo se llama la agrupación de lotes en este proyecto («Manzana», «Sector»…). */
  etiquetaAgrupador?: string;
  /** Cómo se llama cada unidad («Lote», «Módulo»…). */
  etiquetaNumero?: string;
  /** Frente del lote en metros (lotes industriales). */
  frenteM?: number;
  /** Potencia eléctrica disponible en kW (lotes industriales). */
  potenciaKw?: number;
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

// Perfil de documento: HABILITACION_URBANA (por defecto, lo que usa mapa_renasur), INDUSTRIAL (lotes industriales: etiquetas del proyecto, frente y potencia) o PREDIO
// (predio en general, sin proyecto/manzana/lote). Ver lib/generators/perfilDocumento.ts.
export type PerfilDocumento = 'HABILITACION_URBANA' | 'PREDIO' | 'INDUSTRIAL';

// Profesional que firma el plano (opcional). Se imprime en el membrete del perfil PREDIO.
export interface ProfesionalResponsable {
  nombre?: string;
  /** Colegiatura tal como se escribe, p. ej. "CIP 123456". */
  colegiatura?: string;
}

export interface PlanoConfig {
  perfil?: PerfilDocumento;
  profesional?: ProfesionalResponsable;
  incluirMemoriaDescriptiva: boolean;
  incluirPlanoPerimetrico: boolean;
  incluirPlanoUbicacion: boolean;
  // Independiente de incluirPlanoPerimetrico: por defecto sigue a ese mismo
  // flag (comportamiento actual, expediente completo), pero se puede pedir
  // solo la copia sin el original (ej. documento "resumen" para no-admins).
  incluirPlanoPerimetricoCopia?: boolean;
  // Si está activo, MemoriaDescriptivaGenerator dibuja únicamente el
  // encabezado + "III. LINDEROS Y MEDIDAS PERIMÉTRICAS" + pie de página,
  // saltando el resto de secciones (I, II, IV, V, VI). Pensado para el
  // documento "resumen" — nunca se usa en el expediente completo.
  soloSeccionLinderosEnMemoria?: boolean;
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
      /** Color hex del trazo/contorno (elemento.urbano.capa en Odoo). Dinámico, no un enum fijo. */
      colorBorde?: string;
      /** Color hex del relleno — independiente de colorBorde (elemento.urbano.capa en Odoo). */
      colorRelleno?: string;
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
  // Identidad del staff de mapa_renasur que originó la solicitud (uid/nombre
  // de Odoo) — no es autenticación, solo se usa para auditoría de descargas
  // (ver /api/v1/planos/generar-resumen). El generador de PDF no la usa.
  staff?: {
    uid: number;
    nombre: string;
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
