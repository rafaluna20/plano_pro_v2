/**
 * PlanosPayload.ts - Definiciones de Tipos para API Híbrida de Planos
 *
 * Este archivo define el contrato de datos para la generación de planos
 * con lógica híbrida: Prioridad de Datos Registrales con Fallback Geométrico
 *
 * Versión: v4 (REQ-HYBRID-001)
 * Stack: Next.js + Turf.js + jsPDF
 */

// ============================================================================
// TIPOS GEOJSON (Simplificados para nuestro uso)
// ============================================================================

export type Coordinates = number[][];

export interface Geometry<T = any> {
  type: "Polygon" | "Point" | "LineString";
  coordinates: T;
}

export interface Feature<G = Geometry, P = any> {
  type: "Feature";
  id?: string;
  properties: P;
  geometry: G;
}

export interface FeatureCollection<G = Geometry, P = any> {
  type: "FeatureCollection";
  features: Feature<G, P>[];
}

// ============================================================================
// DATOS REGISTRALES (Fuente: Registros Públicos / SUNARP)
// ============================================================================

/**
 * Lindero según documentación registral
 */
export interface LinderoRegistral {
  /** Índice del lindero (0-based, orden antihorario desde frente) */
  index: number;

  /** Descripción del tramo (ej: "V1 - V2") */
  tramo: string;

  /** Longitud como texto registral (puede diferir de la geometría) */
  longitudTexto: string;

  /** Ángulo interno en el vértice (en grados, calculado automáticamente) */
  anguloInterno?: number;

  /** Descripción textual de la colindancia */
  colindanciaTexto: string;

  /** Orientación cardinal o relativa */
  orientacion: "FRENTE" | "DERECHA" | "FONDO" | "IZQUIERDA" | "ESQUINA";

  /** Si este lado es un arco de circunferencia (ver x_geometry_arcos en Odoo), no una línea recta. */
  esArco?: boolean;

  /** Radio del arco (solo si esArco). */
  radioArco?: number;
}

/**
 * Datos oficiales de Registros Públicos
 *
 * IMPORTANTE: Estos datos tienen PRIORIDAD sobre cálculos geométricos
 * pero pueden ser `null` si no están disponibles (entonces se calcula)
 */
export interface DatosRegistrales {
  /** Área oficial en m² (null = calcular desde geometría) */
  areaOficial: number | null;

  /** Perímetro oficial en ml (null = calcular desde geometría) */
  perimetroOficial: number | null;

  /** Array de linderos registrales (null = derivar desde geometría) */
  linderos: LinderoRegistral[] | null;
}

// ============================================================================
// LOTE OBJETIVO (El Protagonista)
// ============================================================================

/**
 * Identificador catastral del lote
 */
export interface IdentificadorLote {
  manzana: string;
  lote: string;
  subLote?: string;
  etapa?: string;
  urbanizacion?: string;
}

/**
 * Información comercial (opcional)
 */
export interface InformacionComercial {
  precio?: number;
  moneda?: string;
  estado?: "libre" | "vendido" | "ocupado" | "reservado";
  fechaVenta?: string;
}

/**
 * Ubicación administrativa
 */
export interface UbicacionAdministrativa {
  departamento: string;
  provincia: string;
  distrito: string;
  direccion?: string;
  // Zona UTM (17|18|19, hemisferio sur). Si se omite, los generadores usan
  // DEFAULT_UTM_ZONE (18, lib/geometry/utmUtils.ts) — correcto para Lima,
  // incorrecto para proyectos en el extremo norte o sur de Perú.
  zonaUTM?: number;
}

/**
 * Datos del titular registral
 */
export interface Titularidad {
  nombre: string;
  documento?: {
    tipo: "DNI" | "RUC" | "CE" | "PAS";
    numero: string;
  };
  partidaRegistral?: string;
}

/**
 * Propiedades del lote objetivo
 */
export interface LoteObjetivoProperties {
  codigoInterno: string;
  identificador: IdentificadorLote;
  comercial?: InformacionComercial;
  ubicacion?: UbicacionAdministrativa;
  titularidad?: Titularidad;

  /**
   * Vértices ORIGINALES del polígono (cerrado, sin muestreo de arcos) — la
   * geometría en `geometry.coordinates` ya viene expandida con puntos
   * intermedios en cada lado curvo (ver expandirVerticesConArcos) para que
   * el DIBUJO de la curva salga correcto, pero eso rompe cualquier cálculo
   * que necesite UN vértice/lado por esquina real (ángulos internos,
   * cuadro técnico, cotas). Estos son esos vértices reales.
   */
  verticesOriginales?: [number, number][];

  /** Metadata de lados curvos del polígono principal (ver x_geometry_arcos en Odoo). */
  arcos?: import("./planos").ArcoMetadata[];
}

/**
 * Lote Objetivo (GeoJSON Feature)
 */
export type LoteObjetivo = Feature<
  Geometry<number[][][]>, // Polygon coordinates
  LoteObjetivoProperties
>;

// ============================================================================
// CONTEXTO (Lotes Vecinos y Vías)
// ============================================================================

/**
 * Propiedades de un elemento de contexto
 */
export interface ContextoElementoProperties {
  /**
   * Tipo de elemento. "lote" es el único valor reservado (lote vecino común,
   * sin color propio). Cualquier otro string es un código de capa dinámico
   * definido en Odoo (elemento.urbano.capa) — ya no es un enum fijo: una
   * capa nueva no requiere cambios de código acá, solo trae su propio
   * "color"/"mostrarEtiqueta" en el payload.
   */
  tipo: string;

  /** Color hex del trazo/contorno (ver elemento.urbano.capa en Odoo). Ausente para tipo "lote". */
  colorBorde?: string;

  /** Color hex del relleno — independiente de colorBorde. Ausente para tipo "lote". */
  colorRelleno?: string;

  /** Si se debe imprimir "nombre"/"numeroLote" como etiqueta sobre el polígono. */
  mostrarEtiqueta?: boolean;

  /** Si la capa es área (polígono relleno) o línea (trazo abierto, sin relleno). Default true. */
  esArea?: boolean;

  /** Solo aplica si esArea=true: dibuja el polígono cerrado sin color de relleno, solo el borde. */
  sinRelleno?: boolean;

  /** Solo aplica si esArea=true: opuesto a sinRelleno — dibuja el relleno sin trazo de contorno. */
  sinBorde?: boolean;

  /** Presente solo si el elemento es un círculo completo (centro+radio en UTM), en vez de un polígono. */
  circulo?: { centro: [number, number]; radio: number };

  /** Nombre o número identificador */
  nombre?: string;
  numeroLote?: string;

  /** Estado (para lotes) */
  estado?: "libre" | "vendido" | "ocupado";

  /** Propiedades de vía (para calles) */
  anchoVia?: number;
  posicionRelativa?: "NORTE" | "SUR" | "ESTE" | "OESTE";

  /** Descripción alternativa */
  descripcionAlterna?: string;
}

/**
 * Colección de contexto (vecinos + calles)
 */
export type ContextoGeoespacial = FeatureCollection<
  Geometry<number[][][]>, // Polygon coordinates
  ContextoElementoProperties
>;

// ============================================================================
// CONFIGURACIÓN DE IMPRESIÓN
// ============================================================================

/**
 * Estilos visuales del plano
 */
export interface EstilosPlano {
  mostrarCotas: boolean;
  mostrarGrilla: boolean;
  colorLote: string;
  colorContexto: string;
  grosorLineaContexto: number;
  grosorLineaLote: number;
}

/**
 * Configuración de generación de documentos
 */
export interface ConfiguracionImpresion {
  incluirMemoriaDescriptiva: boolean;
  incluirPlanoPerimetrico: boolean;
  incluirPlanoUbicacion: boolean;
  formatoPapel: "A3" | "A4" | "A2" | "A1" | "A0";
  orientacion: "landscape" | "portrait";
  escala: string | null; // "1/500" o null para auto
  estilos: EstilosPlano;
  /** Modo de ubicación para el croquis: vectorial (SVG), satelital (imagen satélite), imagen */
  modoUbicacion?: "vectorial" | "satelital" | "imagen";
  /** URL del logo de la empresa. Si está vacío/undefined, se muestra el texto "LOGO" */
  logoUrl?: string;
  /** URL de la imagen general para el modo 'imagen' */
  imagenGeneral?: string;
}

// ============================================================================
// METADATOS DE LA SOLICITUD
// ============================================================================

/**
 * Metadatos de la petición
 */
export interface MetadataSolicitud {
  solicitudId: string;
  timestamp: string; // ISO 8601
  crs: string; // Sistema de coordenadas (ej: "EPSG:32718")
  logicaAplicada:
    | "PRIORIDAD_REGISTRAL_CON_FALLBACK_GEOMETRICO"
    | "SOLO_GEOMETRICO"
    | "SOLO_REGISTRAL";
}

// ============================================================================
// PAYLOAD COMPLETO (Request de la API)
// ============================================================================

/**
 * Estructura completa del payload para generación de planos híbridos
 *
 * Este es el contrato principal entre el cliente y la API.
 * Implementa la lógica:
 * 1. Si `datosRegistrales.areaOficial` existe → usar ese valor
 * 2. Si es null → calcular desde `loteObjetivo.geometry`
 * 3. Aplicar la misma lógica para perímetro y linderos
 */
export interface PlanoPayloadHibrido {
  /** Metadatos de la solicitud */
  meta: MetadataSolicitud;

  /** Lote principal (geometría + propiedades) */
  loteObjetivo: LoteObjetivo;

  /** Datos oficiales (pueden ser null para cálculo automático) */
  datosRegistrales: DatosRegistrales;

  /** Contexto geoespacial (vecinos y vías) */
  contexto: ContextoGeoespacial;

  /** Configuración de generación */
  configImpresion: ConfiguracionImpresion;
}

// ============================================================================
// TIPOS DE RESPUESTA DE LA API
// ============================================================================

/**
 * Datos calculados por la API (cuando datosRegistrales era null)
 */
export interface DatosCalculados {
  areaCalculada: number;
  perimetroCalculado: number;
  linderosCalculados: LinderoRegistral[];
  fuenteDatos: "REGISTRAL" | "CALCULADO" | "MIXTO";
}

/**
 * Respuesta exitosa de la API
 */
export interface PlanoResponseExito {
  success: true;
  data: {
    planoId: string;
    pdfUrl?: string; // URL del PDF generado (si está disponible inmediatamente)
    status: "pending" | "processing" | "completed";
    datosUtilizados: DatosCalculados;
  };
}

/**
 * Respuesta de error de la API
 */
export interface PlanoResponseError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Respuesta de la API (unión de tipos)
 */
export type PlanoResponse = PlanoResponseExito | PlanoResponseError;

// ============================================================================
// TYPE GUARDS (Utilidades de validación)
// ============================================================================

/**
 * Verifica si los datos registrales están completos
 */
export function tieneDataRegistralCompleta(datos: DatosRegistrales): boolean {
  return (
    datos.areaOficial !== null &&
    datos.perimetroOficial !== null &&
    datos.linderos !== null &&
    datos.linderos.length > 0
  );
}

/**
 * Verifica si es necesario calcular datos
 */
export function requiereCalculoGeometrico(datos: DatosRegistrales): boolean {
  return !tieneDataRegistralCompleta(datos);
}

/**
 * Valida que el payload tenga la estructura mínima requerida
 */
export function esPayloadValido(payload: any): payload is PlanoPayloadHibrido {
  return (
    payload &&
    typeof payload === "object" &&
    payload.meta &&
    payload.loteObjetivo &&
    payload.loteObjetivo.type === "Feature" &&
    payload.loteObjetivo.geometry &&
    payload.loteObjetivo.geometry.type === "Polygon" &&
    payload.datosRegistrales &&
    payload.contexto &&
    payload.contexto.type === "FeatureCollection"
  );
}
