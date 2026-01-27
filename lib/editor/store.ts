import { create } from 'zustand';
import {
  EditorMode,
  DrawingMode,
  ViewMode,
  DrawingTool,
  Layer,
  EditorConfig
} from '@/types/editor';
import { UTMCoordinate } from '@/types/planos';
import { CoordinateSystem, createCoordinateSystem } from '@/lib/geometry/coordinateSystem';

interface EditorStore {
  // Estado
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
  config: EditorConfig;
  
  // Sistema de coordenadas
  coordinateSystem: CoordinateSystem;
  setOrigin: (lat: number, lng: number) => void;
  updateCoordinateSystem: (updates: Partial<CoordinateSystem>) => void;
  
  // Modo calcar (overlay del mapa en canvas)
  overlayMode: boolean;
  overlayOpacity: number;
  toggleOverlayMode: () => void;
  setOverlayOpacity: (opacity: number) => void;
  
  // Datos del plano (ahora en coordenadas RELATIVAS)
  relativeVertices: [number, number][]; // metros desde origen
  vertices: UTMCoordinate[]; // backward compatibility
  
  // Historial (undo/redo)
  history: {
    past: UTMCoordinate[][];
    future: UTMCoordinate[][];
  };
  
  // Acciones
  setMode: (mode: EditorMode) => void;
  setDrawingMode: (mode: DrawingMode) => void;
  setViewMode: (mode: ViewMode) => void;
  setActiveTool: (tool: DrawingTool) => void;
  selectLayer: (layerId: string | null) => void;
  toggleSnap: () => void;
  toggleGrid: () => void;
  setGridSize: (size: number) => void;
  setZoom: (zoom: number) => void;
  setCenter: (center: [number, number]) => void;
  updateConfig: (config: Partial<EditorConfig>) => void;
  
  // Layers
  addLayer: (layer: Layer) => void;
  removeLayer: (layerId: string) => void;
  updateLayer: (layerId: string, updates: Partial<Layer>) => void;
  toggleLayerVisibility: (layerId: string) => void;
  toggleLayerLock: (layerId: string) => void;
  
  // Vértices
  setVertices: (vertices: UTMCoordinate[]) => void;
  addVertex: (vertex: UTMCoordinate) => void;
  updateVertex: (index: number, vertex: UTMCoordinate) => void;
  removeVertex: (index: number) => void;
  
  // Historial
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  
  // Reset
  reset: () => void;
}

const defaultConfig: EditorConfig = {
  canvas: {
    showGrid: true,
    snapToGrid: true,
    gridSize: 1,
    showRulers: true
  },
  units: {
    system: 'metric',
    precision: 0.01
  },
  visualization: {
    theme: 'light',
    showTooltips: true,
    enableAnimations: true
  },
  validation: {
    autoValidate: true,
    showWarnings: true,
    blockOnErrors: true
  }
};

export const useEditorStore = create<EditorStore>((set, get) => ({
  // Estado inicial
  mode: EditorMode.WIZARD,
  drawingMode: DrawingMode.SELECT,
  viewMode: ViewMode.FULL,
  activeTool: DrawingTool.SELECT,
  selectedLayer: null,
  layers: [],
  snapEnabled: true,
  gridEnabled: true,
  gridSize: 1,
  zoom: 1,
  center: [0, 0],
  config: defaultConfig,
  
  // Sistema de coordenadas
  coordinateSystem: createCoordinateSystem(),
  setOrigin: (lat, lng) => set({
    coordinateSystem: createCoordinateSystem({ lat, lng })
  }),
  updateCoordinateSystem: (updates) => set((state) => ({
    coordinateSystem: { ...state.coordinateSystem, ...updates }
  })),
  
  // Modo calcar
  overlayMode: false,
  overlayOpacity: 0.5,
  toggleOverlayMode: () => set((state) => ({ overlayMode: !state.overlayMode })),
  setOverlayOpacity: (opacity) => set({ overlayOpacity: Math.max(0, Math.min(1, opacity)) }),
  
  // Vértices relativos
  relativeVertices: [],
  vertices: [], // backward compatibility
  history: {
    past: [],
    future: []
  },
  
  // Acciones básicas
  setMode: (mode) => set({ mode }),
  setDrawingMode: (drawingMode) => set({ drawingMode }),
  setViewMode: (viewMode) => set({ viewMode }),
  setActiveTool: (activeTool) => set({ activeTool }),
  selectLayer: (selectedLayer) => set({ selectedLayer }),
  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
  toggleGrid: () => set((state) => ({ gridEnabled: !state.gridEnabled })),
  setGridSize: (gridSize) => set({ gridSize }),
  setZoom: (zoom) => set({ zoom }),
  setCenter: (center) => set({ center }),
  updateConfig: (config) => set((state) => ({ 
    config: { ...state.config, ...config } 
  })),
  
  // Layers
  addLayer: (layer) => set((state) => ({ 
    layers: [...state.layers, layer] 
  })),
  removeLayer: (layerId) => set((state) => ({ 
    layers: state.layers.filter(l => l.id !== layerId) 
  })),
  updateLayer: (layerId, updates) => set((state) => ({
    layers: state.layers.map(l => 
      l.id === layerId ? { ...l, ...updates } : l
    )
  })),
  toggleLayerVisibility: (layerId) => set((state) => ({
    layers: state.layers.map(l =>
      l.id === layerId ? { ...l, visible: !l.visible } : l
    )
  })),
  toggleLayerLock: (layerId) => set((state) => ({
    layers: state.layers.map(l =>
      l.id === layerId ? { ...l, locked: !l.locked } : l
    )
  })),
  
  // Vértices con historial (ahora trabaja con coordenadas relativas)
  setVertices: (vertices) => {
    const state = get();
    set({
      vertices, // backward compatibility
      relativeVertices: vertices as any, // Se convertirán después
      history: {
        past: [...state.history.past, state.vertices],
        future: []
      }
    });
  },
  addVertex: (vertex) => {
    const state = get();
    set({
      vertices: [...state.vertices, vertex],
      relativeVertices: [...state.relativeVertices, vertex as any],
      history: {
        past: [...state.history.past, state.vertices],
        future: []
      }
    });
  },
  updateVertex: (index, vertex) => {
    const state = get();
    const newVertices = [...state.vertices];
    newVertices[index] = vertex;
    const newRelative = [...state.relativeVertices];
    newRelative[index] = vertex as any;
    set({
      vertices: newVertices,
      relativeVertices: newRelative,
      history: {
        past: [...state.history.past, state.vertices],
        future: []
      }
    });
  },
  removeVertex: (index) => {
    const state = get();
    set({
      vertices: state.vertices.filter((_, i) => i !== index),
      relativeVertices: state.relativeVertices.filter((_, i) => i !== index),
      history: {
        past: [...state.history.past, state.vertices],
        future: []
      }
    });
  },
  
  // Historial
  undo: () => {
    const state = get();
    if (state.history.past.length === 0) return;
    
    const previous = state.history.past[state.history.past.length - 1];
    const newPast = state.history.past.slice(0, -1);
    
    set({
      vertices: previous,
      history: {
        past: newPast,
        future: [state.vertices, ...state.history.future]
      }
    });
  },
  redo: () => {
    const state = get();
    if (state.history.future.length === 0) return;
    
    const next = state.history.future[0];
    const newFuture = state.history.future.slice(1);
    
    set({
      vertices: next,
      history: {
        past: [...state.history.past, state.vertices],
        future: newFuture
      }
    });
  },
  canUndo: () => get().history.past.length > 0,
  canRedo: () => get().history.future.length > 0,
  
  // Reset
  reset: () => set({
    mode: EditorMode.WIZARD,
    drawingMode: DrawingMode.SELECT,
    viewMode: ViewMode.FULL,
    activeTool: DrawingTool.SELECT,
    selectedLayer: null,
    layers: [],
    snapEnabled: true,
    gridEnabled: true,
    gridSize: 1,
    zoom: 1,
    center: [0, 0],
    coordinateSystem: createCoordinateSystem(),
    relativeVertices: [],
    vertices: [],
    history: {
      past: [],
      future: []
    }
  })
}));
