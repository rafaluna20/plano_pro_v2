/**
 * PlanoTheme.ts - Fuente Única de Verdad para Estilos de Planos
 * 
 * Este archivo centraliza toda la configuración visual del sistema de generación de planos.
 * Al modificar valores aquí, los cambios se propagan automáticamente a todos los planos generados.
 * 
 * Principio: NO usar "magic numbers" en el código principal.
 * Todo debe venir de esta configuración tipada.
 */

export const PLANO_THEME = {
  // ============================================================================
  // 1. CONFIGURACIÓN DE PÁGINA Y LAYOUT
  // ============================================================================
  LAYOUT: {
    // Formato y orientación del documento
    FORMATO: 'a4' as const,
    ORIENTACION: 'landscape' as const,

    // Márgenes de página (en mm)
    MARGENES: {
      SUPERIOR: 10,
      INFERIOR: 10,
      IZQUIERDO: 10,
      DERECHO: 10
    },

    // Marco profesional (doble línea)
    MARCO: {
      EXTERNO_OFFSET: 5,    // Distancia del borde del papel al marco externo
      INTERNO_OFFSET: 8,    // Distancia al marco interno
      EXTERNO_WIDTH: 0.8,   // Grosor línea externa
      INTERNO_WIDTH: 0.2    // Grosor línea interna
    },

    // Definición de las áreas principales
    COLUMNA_DERECHA_ANCHO: 100,  // Ancho de la columna de información (mm)

    // Alturas de bloques en la columna derecha (en mm)
    ALTURAS: {
      HEADER: 12,        // Barra de título superior
      UBICACION: 85,     // Cuadro de ubicación (croquis)
      MEMBRETE: 55       // Membrete inferior con datos del proyecto
      // NOTA: El cuadro técnico se calcula dinámicamente con el espacio restante
    },

    GAP: 5,  // Espacio entre cajas (en mm)

    // Área de dibujo principal
    DIBUJO: {
      MARGEN_INTERNO: 20  // Margen para que el lote no toque los bordes del área
    }
  },

  // ============================================================================
  // 2. PALETA DE COLORES (Semántica)
  // ============================================================================
  COLORS: {
    // Colores principales
    PRIMARY: '#383838',           // Líneas principales, textos importantes
    SECONDARY: '#686868',         // Textos secundarios
    DIMMED: '#808080',           // Etiquetas de menor importancia

    // Fondos
    BACKGROUND_FILL: '#FFFFFF',   // Fondo blanco puro
    CONTEXT_FILL: '#F5F5F5',      // Relleno suave para lote sobre contexto
    NEIGHBOR_FILL: '#FCFCFC',     // Relleno casi blanco para vecinos
    TABLE_HEADER: '#E6E6E6',      // Fondo de encabezados de tabla (gris claro)
    TABLE_ZEBRA: '#F8F8F8',       // Fondo alternado de filas (zebra striping)

    // Relleno Sombreado (Professional Cadastral Style)
    MAIN_LOTE_FILL: '#D0D0D0',    // Gris medio suave para destacar el lote principal

    // Elementos de interfaz
    ACCENT_LINE: '#CCCCCC',       // Líneas de grilla o separadores
    GRID_LINE: '#969696',         // Líneas de grilla UTM (gris medio)
    NEIGHBOR_STROKE: '#AAAAAA',   // Bordes de lotes vecinos

    // Colores especiales
    WHITE: '#FFFFFF',
    BLACK: '#4e4d4d',

    // Debug (solo para desarrollo)
    DEBUG: '#FF0000'
  },

  // ============================================================================
  // 2b. ELEMENTOS URBANOS (calles, parques, agua, etc. — capas dinámicas)
  // ============================================================================
  // El color y si se muestra etiqueta ya NO viven acá: cada elemento trae su
  // propio "color"/"mostrarEtiqueta" en el payload (ver
  // ContextoElementoProperties), definidos como "capa" editable en Odoo
  // (elemento.urbano.capa, estilo AutoCAD) — un tipo/color nuevo no requiere
  // tocar código. Este es solo el color de respaldo si algo llega sin color
  // (dato viejo, capa borrada, etc.).
  ELEMENTO_URBANO_FALLBACK_COLOR: '#AAAAAA',

  // ============================================================================
  // 3. GROSORES DE LÍNEA (Line Weights en mm)
  // ============================================================================
  STROKES: {
    LOTE_BOUNDARY: 0.6,      // Límite de propiedad (EL MÁS GRUESO - Protagonista)
    FRAME_OUTER: 0.8,        // Marco externo del papel
    FRAME_INNER: 0.3,        // Marcos de tablas y cajas
    DATA_LINES: 0.2,         // Líneas de dibujo técnico general
    GRID: 0.1,               // Grilla de fondo (muy fina)
    NEIGHBOR: 0.1,           // Bordes de lotes vecinos
    HAIRLINE: 0.05,          // Tramas o detalles mínimos
    SEPARATOR: 0.5,          // Separadores visuales destacados
    NORTH_ARROW: 0.3         // Flecha de norte
  },

  // ============================================================================
  // 4. TIPOGRAFÍA
  // ============================================================================
  FONTS: {
    MAIN: 'helvetica' as const,

    SIZES: {
      H1: 14,       // Título Principal (PLANO PERIMÉTRICO)
      H2: 11,       // Subtítulos (barra superior)
      H3: 10,       // Títulos de sección
      BODY: 8,      // Texto estándar (datos en membrete)
      LABEL: 7,     // Etiquetas de campos
      SMALL: 6,     // Cotas, detalles, coordenadas
      TINY: 5       // Notas legales o coordenadas muy densas
    },

    WEIGHTS: {
      NORMAL: 'normal' as const,
      BOLD: 'bold' as const
    }
  },

  // ============================================================================
  // 5. CONFIGURACIÓN DE ELEMENTOS ESPECÍFICOS
  // ============================================================================

  // Cuadro Técnico de Coordenadas
  TABLA_TECNICA: {
    HEADER_HEIGHT: 6,       // Altura del header principal
    SUBHEADER_HEIGHT: 5,    // Altura del sub-header con columnas
    ROW_HEIGHT: 4.5,        // Altura de cada fila de datos

    // Distribución porcentual de columnas (debe sumar ~100)
    COLUMNAS: {
      VERTICE: 10,
      LADO: 15,
      DISTANCIA: 15,
      ANGULO: 15,
      ESTE: 22.5,
      NORTE: 22.5
    }
  },

  // Membrete Profesional
  MEMBRETE: {
    LOGO_COLUMN_PERCENT: 0.35,  // 35% para logo, 65% para datos
    NUM_FILAS: 5,                // Número de filas de información
    PADDING_H: 3                 // Padding horizontal interno
  },

  // Plano de Ubicación (Croquis)
  UBICACION: {
    HEADER_HEIGHT: 5,
    MARGIN_FACTOR: 0.85,     // Factor de seguridad (85% del espacio = 15% margen)
    NORTH_SIZE: 8,            // Tamaño del símbolo de norte
    LOTE_LINE_WIDTH: 0.3,
    VECINO_LINE_WIDTH: 0.1
  },

  // Norte Catastro (Mapa principal)
  NORTE: {
    SIZE: 20,                // Tamaño del símbolo de norte en el mapa principal
    OFFSET_X: 25,            // Distancia desde el borde derecho
    OFFSET_Y: 35             // Distancia desde el borde superior
  },

  // Título Principal
  TITULO: {
    OFFSET_BOTTOM: 30,       // 30mm desde el borde inferior del área de dibujo
    PADDING_H: 4,            // Padding horizontal de la caja blanca
    PADDING_V: 6,            // Padding vertical de la caja blanca
    BOX_HEIGHT: 10           // Altura de la caja blanca de fondo
  },

  // Etiqueta Central del Lote
  ETIQUETA_CENTRAL: {
    WIDTH: 28,               // Ancho de la caja
    HEIGHT: 10,              // Alto de la caja
    LINE_SPACING: 3.5        // Espaciado entre líneas de texto
  },

  // Grilla UTM
  GRILLA: {
    INTERVALS: {
      GRANDE: 100,           // Para escalas >= 1:2000
      MEDIO: 50,             // Para escalas >= 1:500
      PEQUENO: 20            // Para escalas < 1:500
    },
    SCALE_THRESHOLDS: {
      GRANDE: 2000,
      MEDIO: 500
    }
  },

  // ============================================================================
  // 6. CONFIGURACIÓN DE DESARROLLO
  // ============================================================================
  DEBUG_MODE: false  // Activa elementos visuales de debug (bordes rojos, etc.)
} as const;

/**
 * Tipos derivados para TypeScript
 */
export type PlanoThemeType = typeof PLANO_THEME;
export type PlanoColorKey = keyof typeof PLANO_THEME.COLORS;
export type PlanoStrokeKey = keyof typeof PLANO_THEME.STROKES;
export type PlanoFontSize = keyof typeof PLANO_THEME.FONTS.SIZES;

/**
 * Helper para acceso tipado a colores
 */
export const getColor = (key: PlanoColorKey): string => {
  return PLANO_THEME.COLORS[key];
};

/**
 * Helper para acceso tipado a grosores
 */
export const getStroke = (key: PlanoStrokeKey): number => {
  return PLANO_THEME.STROKES[key];
};

/**
 * Helper para acceso tipado a tamaños de fuente
 */
export const getFontSize = (key: PlanoFontSize): number => {
  return PLANO_THEME.FONTS.SIZES[key];
};

/**
 * Calcula el intervalo de grilla apropiado según la escala
 */
export const getGridInterval = (escala: number): number => {
  const { INTERVALS, SCALE_THRESHOLDS } = PLANO_THEME.GRILLA;

  if (escala >= SCALE_THRESHOLDS.GRANDE) return INTERVALS.GRANDE;
  if (escala >= SCALE_THRESHOLDS.MEDIO) return INTERVALS.MEDIO;
  return INTERVALS.PEQUENO;
};
