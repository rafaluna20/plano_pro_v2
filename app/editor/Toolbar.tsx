'use client';

import {
  MousePointer2,
  PenTool,
  Ruler,
  Grid,
  Magnet,
  Undo2,
  Redo2,
  Type,
  Move,
  Maximize2,
  Map,
  Layers
} from 'lucide-react';
import { useEditorStore } from '@/lib/editor/store';
import { DrawingTool } from '@/types/editor';

interface ToolButtonProps {
  tool: DrawingTool;
  icon: React.ElementType;
  label: string;
  shortcut?: string;
  onClick?: () => void;
}

const ToolButton = ({ tool, icon: Icon, label, shortcut, onClick }: ToolButtonProps) => {
  const { activeTool, setActiveTool } = useEditorStore();
  
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setActiveTool(tool);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`p-3 rounded-lg flex items-center justify-center transition-all duration-200 group relative ${
        activeTool === tool 
          ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300' 
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
      }`}
      aria-label={label}
    >
      <Icon size={20} />
      
      {/* Tooltip Profesional */}
      <span className="absolute left-14 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
        {label}
        {shortcut && <span className="ml-2 text-gray-400">({shortcut})</span>}
      </span>
    </button>
  );
};

interface ToggleButtonProps {
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}

const ToggleButton = ({ active, icon: Icon, label, onClick }: ToggleButtonProps) => (
  <button
    onClick={onClick}
    className={`p-3 rounded-lg transition-all duration-200 group relative ${
      active 
        ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300' 
        : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
    }`}
    title={label}
    aria-label={label}
  >
    <Icon size={20} />
    
    {/* Tooltip */}
    <span className="absolute left-14 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
      {label}
    </span>
  </button>
);

interface ToolbarProps {
  viewMode?: 'map' | 'canvas';
  onViewModeChange?: (mode: 'map' | 'canvas') => void;
}

export function Toolbar({ viewMode = 'canvas', onViewModeChange }: ToolbarProps) {
  const {
    config,
    updateConfig,
    undo,
    redo,
    canUndo,
    canRedo,
    snapEnabled,
    gridEnabled,
    overlayMode,
    coordinateSystem,
    toggleSnap,
    toggleGrid,
    toggleOverlayMode
  } = useEditorStore();

  // Keyboard shortcuts handler (opcional, se puede agregar después)
  // useEffect(() => {
  //   const handleKeyPress = (e: KeyboardEvent) => {
  //     if (e.ctrlKey || e.metaKey) {
  //       if (e.key === 'z' && !e.shiftKey) { undo(); }
  //       if (e.key === 'z' && e.shiftKey || e.key === 'y') { redo(); }
  //     }
  //   };
  //   window.addEventListener('keydown', handleKeyPress);
  //   return () => window.removeEventListener('keydown', handleKeyPress);
  // }, [undo, redo]);

  return (
    <div className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-2 z-10 shadow-sm">
      
      {/* Toggle Vista Mapa/Canvas */}
      {onViewModeChange && (
        <>
          <div className="flex flex-col gap-2 w-full px-2">
            <ToggleButton
              active={viewMode === 'map'}
              icon={Map}
              label="Vista de Mapa (Tab)"
              onClick={() => onViewModeChange(viewMode === 'map' ? 'canvas' : 'map')}
            />
          </div>
          <div className="w-8 h-px bg-gray-200 my-2" />
        </>
      )}
      
      {/* Herramientas Principales */}
      <div className="flex flex-col gap-2 w-full px-2">
        <ToolButton 
          tool={DrawingTool.SELECT} 
          icon={MousePointer2} 
          label="Seleccionar" 
          shortcut="V" 
        />
        <ToolButton 
          tool={DrawingTool.PAN} 
          icon={Move} 
          label="Mover Vista" 
          shortcut="H" 
        />
        <ToolButton 
          tool={DrawingTool.POLYGON} 
          icon={PenTool} 
          label="Dibujar Polígono" 
          shortcut="P" 
        />
        <ToolButton 
          tool={DrawingTool.MEASURE} 
          icon={Ruler} 
          label="Medir Distancia" 
          shortcut="M" 
        />
      </div>

      <div className="w-8 h-px bg-gray-200 my-2" />

      {/* Toggles de Visualización */}
      <div className="flex flex-col gap-2 w-full px-2">
        <ToggleButton
          active={gridEnabled}
          icon={Grid}
          label="Alternar Grilla (G)"
          onClick={toggleGrid}
        />
        
        <ToggleButton
          active={snapEnabled}
          icon={Magnet}
          label="Alternar Snap (S)"
          onClick={toggleSnap}
        />
        
        {coordinateSystem.origin && viewMode === 'canvas' && (
          <ToggleButton
            active={overlayMode}
            icon={Layers}
            label="Modo Calcar (Mapa sobre Canvas)"
            onClick={toggleOverlayMode}
          />
        )}

        <ToggleButton
          active={config.canvas.showRulers}
          icon={Maximize2}
          label="Mostrar Reglas"
          onClick={() => updateConfig({
            canvas: { ...config.canvas, showRulers: !config.canvas.showRulers }
          })}
        />

        <ToggleButton
          active={config.visualization.showTooltips}
          icon={Type}
          label="Mostrar Etiquetas"
          onClick={() => updateConfig({
            visualization: { ...config.visualization, showTooltips: !config.visualization.showTooltips }
          })}
        />
      </div>

      {/* Separador flexible para empujar botones al final */}
      <div className="flex-1" />

      {/* Undo/Redo al final */}
      <div className="flex flex-col gap-2 w-full px-2 pb-2">
        <button 
          onClick={undo} 
          disabled={!canUndo()}
          className="p-3 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all group relative"
          title="Deshacer (Ctrl+Z)"
          aria-label="Deshacer"
        >
          <Undo2 size={20} />
          <span className="absolute left-14 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
            Deshacer (Ctrl+Z)
          </span>
        </button>
        
        <button 
          onClick={redo} 
          disabled={!canRedo()}
          className="p-3 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all group relative"
          title="Rehacer (Ctrl+Y)"
          aria-label="Rehacer"
        >
          <Redo2 size={20} />
          <span className="absolute left-14 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
            Rehacer (Ctrl+Y)
          </span>
        </button>
      </div>
    </div>
  );
}
