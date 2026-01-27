import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { 
  LoteData, 
  Vertice, 
  MembreteData, 
  Dimensiones, 
  Colindantes,
  LoteVecino 
} from '@/lib/schemas/plano.schemas';
import { DEFAULT_LOTE_DATA } from '@/lib/constants/plano';

interface PlanoState {
  // Estado
  data: LoteData;
  loading: boolean;
  showPDFViewer: boolean;
  activeTab: 'general' | 'membrete' | 'contexto' | 'vertices';
  hoveredVertexId: string | null;
  draggingVertexIndex: number | null;
  
  // Acciones - General
  setLoading: (loading: boolean) => void;
  setShowPDFViewer: (show: boolean) => void;
  setActiveTab: (tab: 'general' | 'membrete' | 'contexto' | 'vertices') => void;
  resetData: () => void;
  
  // Acciones - Vértices
  setHoveredVertexId: (id: string | null) => void;
  setDraggingVertexIndex: (index: number | null) => void;
  updateVertex: (index: number, field: keyof Vertice, value: string | number) => void;
  addVertex: () => void;
  removeVertex: (index: number) => void;
  updateVertexPosition: (index: number, x: number, y: number) => void;
  
  // Acciones - Membrete
  updateMembrete: (field: keyof MembreteData, value: string) => void;
  
  // Acciones - Dimensiones y Colindantes
  updateDimension: (field: keyof Dimensiones, value: number) => void;
  updateColindante: (field: keyof Colindantes, value: string) => void;
  
  // Acciones - Lote
  updateLoteId: (id: string) => void;
  updatePropietario: (propietario: string) => void;
  
  // Acciones - Configuración
  toggleGoogleMaps: () => void;
  
  // Acciones - Ubicación
  translateLote: (newCenterX: number, newCenterY: number) => void;
  
  // Acciones - Vecinos
  addVecino: (vecino: LoteVecino) => void;
  removeVecino: (id: string) => void;
}

// Helper para crear copia mutable de los datos por defecto
const createInitialData = (): LoteData => JSON.parse(JSON.stringify(DEFAULT_LOTE_DATA));

export const usePlanoStore = create<PlanoState>()(
  devtools(
    (set, get) => ({
      // Estado inicial
      data: createInitialData(),
      loading: false,
      showPDFViewer: false,
      activeTab: 'general',
      hoveredVertexId: null,
      draggingVertexIndex: null,
      
      // Implementación de acciones
      setLoading: (loading) => set({ loading }),
      
      setShowPDFViewer: (show) => set({ showPDFViewer: show }),
      
      setActiveTab: (tab) => set({ activeTab: tab }),
      
      resetData: () => set({
        data: createInitialData(),
        hoveredVertexId: null,
        draggingVertexIndex: null,
      }),
      
      // Vértices
      setHoveredVertexId: (id) => set({ hoveredVertexId: id }),
      
      setDraggingVertexIndex: (index) => set({ draggingVertexIndex: index }),
      
      updateVertex: (index, field, value) => set((state) => {
        const newVertices = [...state.data.vertices];
        newVertices[index] = { 
          ...newVertices[index], 
          [field]: field === 'id' ? value : parseFloat(value as string) || 0 
        };
        return {
          data: { ...state.data, vertices: newVertices }
        };
      }),
      
      addVertex: () => set((state) => {
        const lastV = state.data.vertices[state.data.vertices.length - 1];
        const newId = String.fromCharCode(lastV.id.charCodeAt(0) + 1);
        return {
          data: {
            ...state.data,
            vertices: [
              ...state.data.vertices,
              { id: newId, x: lastV.x + 5, y: lastV.y }
            ]
          }
        };
      }),
      
      removeVertex: (index) => set((state) => {
        if (state.data.vertices.length <= 3) return state;
        return {
          data: {
            ...state.data,
            vertices: state.data.vertices.filter((_, i) => i !== index)
          }
        };
      }),
      
      updateVertexPosition: (index, x, y) => set((state) => {
        const newVertices = [...state.data.vertices];
        newVertices[index] = { ...newVertices[index], x, y };
        return {
          data: { ...state.data, vertices: newVertices }
        };
      }),
      
      // Membrete
      updateMembrete: (field, value) => set((state) => ({
        data: {
          ...state.data,
          membrete: { ...state.data.membrete, [field]: value }
        }
      })),
      
      // Dimensiones
      updateDimension: (field, value) => set((state) => ({
        data: {
          ...state.data,
          dimensiones: { ...state.data.dimensiones, [field]: value }
        }
      })),
      
      // Colindantes
      updateColindante: (field, value) => set((state) => ({
        data: {
          ...state.data,
          colindantes: { ...state.data.colindantes, [field]: value }
        }
      })),
      
      // Lote
      updateLoteId: (id) => set((state) => ({
        data: { ...state.data, loteId: id }
      })),
      
      updatePropietario: (propietario) => set((state) => ({
        data: { ...state.data, propietario }
      })),
      
      // Configuración
      toggleGoogleMaps: () => set((state) => ({
        data: {
          ...state.data,
          config: {
            ...state.data.config,
            usarGoogleMaps: !state.data.config.usarGoogleMaps
          }
        }
      })),
      
      // Traslación geométrica
      translateLote: (newCenterX, newCenterY) => set((state) => {
        // Calcular centro actual
        let currentCx = 0, currentCy = 0;
        state.data.vertices.forEach(v => { 
          currentCx += v.x; 
          currentCy += v.y; 
        });
        currentCx /= state.data.vertices.length;
        currentCy /= state.data.vertices.length;
        
        // Calcular delta
        const deltaX = newCenterX - currentCx;
        const deltaY = newCenterY - currentCy;
        
        // Trasladar vértices del lote
        const newVertices = state.data.vertices.map(v => ({
          ...v,
          x: parseFloat((v.x + deltaX).toFixed(2)),
          y: parseFloat((v.y + deltaY).toFixed(2))
        }));
        
        // Trasladar vecinos
        const newVecinos = state.data.contexto.vecinos.map(vecino => ({
          ...vecino,
          vertices: vecino.vertices.map(v => ({
            ...v,
            x: parseFloat((v.x + deltaX).toFixed(2)),
            y: parseFloat((v.y + deltaY).toFixed(2))
          }))
        }));
        
        return {
          data: {
            ...state.data,
            vertices: newVertices,
            contexto: {
              ...state.data.contexto,
              vecinos: newVecinos
            }
          }
        };
      }),
      
      // Vecinos
      addVecino: (vecino) => set((state) => ({
        data: {
          ...state.data,
          contexto: {
            ...state.data.contexto,
            vecinos: [...state.data.contexto.vecinos, vecino]
          }
        }
      })),
      
      removeVecino: (id) => set((state) => ({
        data: {
          ...state.data,
          contexto: {
            ...state.data.contexto,
            vecinos: state.data.contexto.vecinos.filter(v => v.id !== id)
          }
        }
      })),
    }),
    {
      name: 'plano-storage',
    }
  )
);

// Selectores optimizados
export const selectVertices = (state: PlanoState) => state.data.vertices;
export const selectMembrete = (state: PlanoState) => state.data.membrete;
export const selectDimensiones = (state: PlanoState) => state.data.dimensiones;
export const selectColindantes = (state: PlanoState) => state.data.colindantes;
export const selectConfig = (state: PlanoState) => state.data.config;
export const selectVecinos = (state: PlanoState) => state.data.contexto.vecinos;
