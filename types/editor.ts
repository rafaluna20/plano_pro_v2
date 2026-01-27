import { UTMCoordinate, LoteMetadata, Dimensiones, Colindancia } from './planos';

// Modos del editor
export enum EditorMode {
  WIZARD = 'wizard',
  FREEFORM = 'freeform',
  TEMPLATE = 'template',
  IMPORT = 'import'
}

export enum DrawingMode {
  SELECT = 'select',
  PAN = 'pan',
  DRAW = 'draw',
  EDIT = 'edit',
  MEASURE = 'measure'
}

export enum ViewMode {
  FULL = 'full',
  FOCUS = 'focus',
  SPLIT = 'split'
}

// Herramientas de dibujo
export enum DrawingTool {
  SELECT = 'select',
  PAN = 'pan',
  ZOOM = 'zoom',
  LINE = 'line',
  POLYGON = 'polygon',
  RECTANGLE = 'rectangle',
  CIRCLE = 'circle',
  ARC = 'arc',
  CURVE = 'curve',
  TEXT = 'text',
  MEASURE = 'measure'
}

// Sistema de capas
export enum LayerType {
  LOTE = 'lote',
  CALLE = 'calle',
  AREA_VERDE = 'area_verde',
  AREA_COMUN = 'area_comun',
  CONSTRUCCION = 'construccion',
  MEDICIONES = 'mediciones',
  ANOTACIONES = 'anotaciones',
  COLINDANCIAS = 'colindancias'
}

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  color: string;
  opacity: number;
  elements: DrawingElement[];
}

export interface DrawingElement {
  id: string;
  type: 'point' | 'line' | 'polygon' | 'circle' | 'text';
  coordinates: UTMCoordinate | UTMCoordinate[];
  properties: Record<string, any>;
  style?: {
    color?: string;
    fillColor?: string;
    strokeWidth?: number;
    opacity?: number;
  };
}

// Wizard
export enum WizardStep {
  METHOD = 1,
  DATA = 2,
  EDIT = 3,
  PROPERTIES = 4,
  REVIEW = 5
}

export enum InputMethod {
  MANUAL = 'manual',
  COORDINATES = 'coordinates',
  IMPORT = 'import',
  TEMPLATE = 'template'
}

export interface WizardState {
  currentStep: WizardStep;
  method: InputMethod | null;
  vertices: UTMCoordinate[];
  lote: Partial<LoteMetadata>;
  colindancias: Colindancia[];
  completed: boolean;
}

// Plantillas
export interface PlanoTemplate {
  id: string;
  name: string;
  description: string;
  category: 'residencial' | 'comercial' | 'industrial' | 'irregular';
  thumbnail?: string;
  vertices: UTMCoordinate[];
  dimensiones?: Partial<Dimensiones>;
  metadata?: Partial<LoteMetadata>;
}

// Validaciones
export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: ValidationSeverity;
  validator: (data: PlanoData) => ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  message: string;
  suggestions?: string[];
}

export interface PlanoData {
  vertices: UTMCoordinate[];
  lote: LoteMetadata;
  dimensiones: Dimensiones;
  colindancias: Colindancia[];
}

// Estado del editor
export interface EditorState {
  mode: EditorMode;
  drawingMode: DrawingMode;
  viewMode: ViewMode;
  activeTool: DrawingTool;
  selectedLayer: string | null;
  layers: Layer[];
  snapEnabled: boolean;
  gridEnabled: boolean;
  gridSize: number;
  zoom: number;
  center: [number, number];
  history: {
    past: PlanoData[];
    present: PlanoData;
    future: PlanoData[];
  };
}

// Configuración
export interface EditorConfig {
  canvas: {
    showGrid: boolean;
    snapToGrid: boolean;
    gridSize: number;
    showRulers: boolean;
  };
  units: {
    system: 'metric' | 'imperial';
    precision: number;
  };
  visualization: {
    theme: 'light' | 'dark';
    showTooltips: boolean;
    enableAnimations: boolean;
  };
  validation: {
    autoValidate: boolean;
    showWarnings: boolean;
    blockOnErrors: boolean;
  };
}

// Importación/Exportación
export interface ImportResult {
  success: boolean;
  vertices?: UTMCoordinate[];
  metadata?: Partial<LoteMetadata>;
  colindancias?: Colindancia[];
  error?: string;
}

export interface ExportFormat {
  type: 'csv' | 'excel' | 'geojson' | 'dxf' | 'pdf';
  options?: Record<string, any>;
}
