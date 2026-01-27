/**
 * Constantes de configuración para el editor de planos
 */

export const PLANO_CONFIG = {
  // Configuración del canvas SVG
  CANVAS: {
    WIDTH: 900,
    HEIGHT: 600,
    MARGIN: 20,
    RIGHT_PANEL_WIDTH: 280,
    MIN_LEFT_PANEL_WIDTH: 100,
  },

  // Configuración de la grilla
  GRID: {
    MAX_LINES: 50,
    MIN_STEP: 1,
    TARGET_STEPS: 5,
    STROKE_COLOR: '#f1f5f9',
    TEXT_COLOR: '#94a3b8',
    TEXT_SIZE: 8,
  },

  // Configuración de vértices
  VERTEX: {
    MIN_COUNT: 3,
    HOVER_RADIUS: 20,
    CIRCLE_RADIUS: 3.5,
    LABEL_OFFSET: 6,
    DEFAULT_STROKE_WIDTH: 1,
    HOVER_STROKE_WIDTH: 2,
  },

  // Configuración del plano
  DRAWING: {
    PADDING: 60,
    POLYGON_STROKE_WIDTH: 2.5,
    ARC_RADIUS: 20,
    LABEL_ARC_RADIUS: 32,
    NORTH_ARROW_HEIGHT: 25,
    NORTH_ARROW_OFFSET: 40,
  },

  // Configuración del mapa de ubicación
  LOCATION_MAP: {
    HEIGHT: 180,
    BUFFER_MULTIPLIER: 2,
    BLOCK_MARGIN_MULTIPLIER: 1.2,
  },

  // Configuración de la tabla de datos técnicos
  TABLE: {
    HEADER_HEIGHT: 20,
    ROW_HEIGHT: 15,
    COLUMN_POSITIONS: [0.12, 0.25, 0.40, 0.55, 0.77] as const,
  },

  // Configuración del membrete
  MEMBRETE: {
    HEIGHT: 110,
    DIVIDER_POSITION: 0.65,
  },

  // Google Maps
  GOOGLE_MAPS: {
    STATIC_MAP_SIZE: '640x640',
    STATIC_MAP_SCALE: 2,
    MAP_TYPE: 'hybrid' as const,
    PATH_STROKE_COLOR: '0xff0000ff',
    PATH_STROKE_WIDTH: 3,
    PATH_FILL_COLOR: '0x00000000', // Transparente
    COORD_DECIMALS: 6,
    DEBOUNCE_MS: 500,
  },

  // Proyecciones
  PROJECTIONS: {
    WGS84: 'EPSG:4326',
    UTM_18S: '+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs',
  },

  // Colores
  COLORS: {
    PRIMARY: '#1e40af',
    PRIMARY_HOVER: '#1e3a8a',
    SUCCESS: '#059669',
    SUCCESS_HOVER: '#047857',
    DANGER: '#dc2626',
    DANGER_HOVER: '#b91c1c',
    WARNING: '#f59e0b',
    NEUTRAL: '#64748b',
    NEUTRAL_LIGHT: '#cbd5e1',
    NEUTRAL_LIGHTER: '#f1f5f9',
    HOVER_ORANGE: '#ea580c',
    HOVER_ORANGE_BG: 'rgba(255, 165, 0, 0.3)',
  },

  // Escalas disponibles
  SCALES: ['1/50', '1/100', '1/200', '1/500', '1/1000', 'Indicada'] as const,

  // Formatos de papel
  PAPER_FORMATS: ['A3', 'A4'] as const,

  // Orientaciones
  ORIENTATIONS: ['landscape', 'portrait'] as const,
} as const;

export const UTM_ZONES = {
  PERU_NORTH: 17,
  PERU_CENTER: 18,
  PERU_SOUTH: 19,
} as const;

export const DEFAULT_LOTE_DATA = {
  loteId: "MZ-C-Lote14",
  propietario: "Inversiones Santa Rosa S.A.C.",
  dimensiones: {
    frente: 10.00,
    fondo: 10.00,
    izquierda: 20.00,
    derecha: 20.00,
    area: 200.00
  },
  colindantes: {
    frente: "Av. Los Alamos",
    fondo: "Lote 05",
    izquierda: "Lote 13",
    derecha: "Lote 15"
  },
  membrete: {
    proyecto: "Habilitación Urbana Los Cedros",
    plano: "Perimétrico y Ubicación",
    profesional: "Ing. Juan Pérez",
    registro: "CIP 123456",
    fecha: new Date().toISOString().split('T')[0],
    lamina: "P-01",
    escala: "1/500"
  },
  vertices: [
    { id: "A", x: 284500.00, y: 8670100.00 },
    { id: "B", x: 284510.00, y: 8670100.00 },
    { id: "C", x: 284510.00, y: 8670080.00 },
    { id: "D", x: 284500.00, y: 8670080.00 }
  ],
  contexto: {
    vecinos: [
      {
        id: "V1",
        nombre: "Lote 13 (Izq)",
        vertices: [
          { id: "1", x: 284490.00, y: 8670100.00 },
          { id: "2", x: 284500.00, y: 8670100.00 },
          { id: "3", x: 284500.00, y: 8670080.00 },
          { id: "4", x: 284490.00, y: 8670080.00 }
        ]
      },
      {
        id: "V2",
        nombre: "Lote 15 (Der)",
        vertices: [
          { id: "1", x: 284510.00, y: 8670100.00 },
          { id: "2", x: 284520.00, y: 8670100.00 },
          { id: "3", x: 284520.00, y: 8670080.00 },
          { id: "4", x: 284510.00, y: 8670080.00 }
        ]
      }
    ]
  },
  config: {
    usarGoogleMaps: false
  }
} as const;
