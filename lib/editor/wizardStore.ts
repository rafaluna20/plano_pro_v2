import { create } from 'zustand';
import { WizardStep, InputMethod, WizardState } from '@/types/editor';
import { UTMCoordinate, LoteMetadata, Colindancia } from '@/types/planos';

interface WizardStore extends WizardState {
  // Navegación
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: WizardStep) => void;
  canProceed: () => boolean;
  
  // Datos
  setMethod: (method: InputMethod) => void;
  setVertices: (vertices: UTMCoordinate[]) => void;
  updateLote: (lote: Partial<LoteMetadata>) => void;
  setColindancias: (colindancias: Colindancia[]) => void;
  
  // Completar
  complete: () => void;
  reset: () => void;
}

export const useWizardStore = create<WizardStore>((set, get) => ({
  // Estado inicial
  currentStep: WizardStep.METHOD,
  method: null,
  vertices: [],
  lote: {},
  colindancias: [],
  completed: false,
  
  // Navegación
  nextStep: () => {
    const state = get();
    if (state.currentStep < WizardStep.REVIEW && state.canProceed()) {
      set({ currentStep: (state.currentStep + 1) as WizardStep });
    }
  },
  
  previousStep: () => {
    const state = get();
    if (state.currentStep > WizardStep.METHOD) {
      set({ currentStep: (state.currentStep - 1) as WizardStep });
    }
  },
  
  goToStep: (step) => set({ currentStep: step }),
  
  canProceed: () => {
    const state = get();
    switch (state.currentStep) {
      case WizardStep.METHOD:
        return state.method !== null;
      case WizardStep.DATA:
        return state.vertices.length >= 3;
      case WizardStep.EDIT:
        return state.vertices.length >= 3;
      case WizardStep.PROPERTIES:
        return !!state.lote.codigo && !!state.lote.nombre;
      case WizardStep.REVIEW:
        return true;
      default:
        return false;
    }
  },
  
  // Datos
  setMethod: (method) => set({ method }),
  setVertices: (vertices) => set({ vertices }),
  updateLote: (lote) => set((state) => ({ 
    lote: { ...state.lote, ...lote } 
  })),
  setColindancias: (colindancias) => set({ colindancias }),
  
  // Completar
  complete: () => set({ completed: true }),
  reset: () => set({
    currentStep: WizardStep.METHOD,
    method: null,
    vertices: [],
    lote: {},
    colindancias: [],
    completed: false
  })
}));
