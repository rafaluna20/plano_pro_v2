'use client';

import { useEditorStore } from '@/lib/editor/store';
import { DrawingTool } from '@/types/editor';
import { ToolButton } from '../ui/ToolButton';
import { ThemeToggle } from './ThemeToggle';
import toast from 'react-hot-toast';

export function DrawingToolbar() {
  const { activeTool, setActiveTool, snapEnabled, toggleSnap, gridEnabled, toggleGrid, canUndo, canRedo, undo, redo } = useEditorStore();

  const handleToolChange = (tool: DrawingTool) => {
    setActiveTool(tool);
    toast.success(`Herramienta: ${getToolName(tool)}`);
  };

  const handleExportPDF = () => {
    toast.success('📄 Generando PDF profesional...');
  };

  const handlePreview = () => {
    toast.success('👁️ Abriendo vista previa del plano...');
  };

  const getToolName = (tool: DrawingTool): string => {
    const names: Record<DrawingTool, string> = {
      [DrawingTool.SELECT]: 'Seleccionar',
      [DrawingTool.PAN]: 'Mano',
      [DrawingTool.ZOOM]: 'Zoom',
      [DrawingTool.LINE]: 'Línea',
      [DrawingTool.POLYGON]: 'Polígono',
      [DrawingTool.RECTANGLE]: 'Rectángulo',
      [DrawingTool.CIRCLE]: 'Círculo',
      [DrawingTool.ARC]: 'Arco',
      [DrawingTool.CURVE]: 'Curva',
      [DrawingTool.TEXT]: 'Texto',
      [DrawingTool.MEASURE]: 'Medición'
    };
    return names[tool] || tool;
  };

  return (
    <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-sm transition-colors">
      <div className="px-4 py-2 flex items-center gap-1">
        {/* Archivo y Edición */}
        <div className="flex items-center gap-1 px-2 border-r border-gray-200 dark:border-slate-700">
          <ToolButton
            icon={<SaveIcon />}
            label="Guardar"
            shortcut="Ctrl+S"
            onClick={() => toast('Guardando proyecto...')}
          />
          <ToolButton
            icon={<ExportIcon />}
            label="Generar PDF"
            shortcut="Ctrl+E"
            onClick={handleExportPDF}
          />
          <ToolButton
            icon={<PreviewIcon />}
            label="Vista Previa"
            shortcut="Ctrl+Shift+P"
            onClick={handlePreview}
          />
          <ToolButton
            icon={<UndoIcon />}
            label="Deshacer"
            shortcut="Ctrl+Z"
            disabled={!canUndo()}
            onClick={undo}
          />
          <ToolButton
            icon={<RedoIcon />}
            label="Rehacer"
            shortcut="Ctrl+Y"
            disabled={!canRedo()}
            onClick={redo}
          />
        </div>

        {/* Herramientas de Selección y Navegación */}
        <div className="flex items-center gap-1 px-2 border-r border-gray-200 dark:border-slate-700">
          <ToolButton
            icon={<SelectIcon />}
            label="Seleccionar"
            shortcut="V"
            active={activeTool === DrawingTool.SELECT}
            onClick={() => handleToolChange(DrawingTool.SELECT)}
          />
          <ToolButton
            icon={<PanIcon />}
            label="Mano"
            shortcut="H"
            active={activeTool === DrawingTool.PAN}
            onClick={() => handleToolChange(DrawingTool.PAN)}
          />
          <ToolButton
            icon={<ZoomIcon />}
            label="Zoom"
            shortcut="Z"
            active={activeTool === DrawingTool.ZOOM}
            onClick={() => handleToolChange(DrawingTool.ZOOM)}
          />
        </div>

        {/* Herramientas de Dibujo */}
        <div className="flex items-center gap-1 px-2 border-r border-gray-200 dark:border-slate-700">
          <ToolButton
            icon={<LineIcon />}
            label="Línea"
            shortcut="L"
            active={activeTool === DrawingTool.LINE}
            onClick={() => handleToolChange(DrawingTool.LINE)}
          />
          <ToolButton
            icon={<PolygonIcon />}
            label="Polígono"
            shortcut="P"
            active={activeTool === DrawingTool.POLYGON}
            onClick={() => handleToolChange(DrawingTool.POLYGON)}
          />
          <ToolButton
            icon={<RectangleIcon />}
            label="Rectángulo"
            shortcut="R"
            active={activeTool === DrawingTool.RECTANGLE}
            onClick={() => handleToolChange(DrawingTool.RECTANGLE)}
          />
          <ToolButton
            icon={<CircleIcon />}
            label="Círculo"
            shortcut="C"
            active={activeTool === DrawingTool.CIRCLE}
            onClick={() => handleToolChange(DrawingTool.CIRCLE)}
          />
        </div>

        {/* Herramientas Avanzadas */}
        <div className="flex items-center gap-1 px-2 border-r border-gray-200 dark:border-slate-700">
          <ToolButton
            icon={<MeasureIcon />}
            label="Medición"
            shortcut="M"
            active={activeTool === DrawingTool.MEASURE}
            onClick={() => handleToolChange(DrawingTool.MEASURE)}
          />
          <ToolButton
            icon={<TextIcon />}
            label="Texto"
            shortcut="T"
            active={activeTool === DrawingTool.TEXT}
            onClick={() => handleToolChange(DrawingTool.TEXT)}
          />
        </div>

        {/* Configuración de Asistencia */}
        <div className="flex items-center gap-1 px-2 border-r border-gray-200 dark:border-slate-700">
          <ToolButton
            icon={<GridIcon />}
            label={snapEnabled ? 'Snap Activado' : 'Snap Desactivado'}
            shortcut="G"
            active={snapEnabled}
            onClick={() => {
              toggleSnap();
              toast(snapEnabled ? 'Snap desactivado' : 'Snap activado');
            }}
          />
          <ToolButton
            icon={<GridLinesIcon />}
            label={gridEnabled ? 'Cuadrícula Visible' : 'Cuadrícula Oculta'}
            active={gridEnabled}
            onClick={() => {
              toggleGrid();
              toast(gridEnabled ? 'Cuadrícula oculta' : 'Cuadrícula visible');
            }}
          />
        </div>

        {/* Tema */}
        <div className="flex items-center gap-1 px-2">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

// Icon components
const SaveIcon = () => (
  <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
    <path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
  </svg>
);

const UndoIcon = () => (
  <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
    <path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
  </svg>
);

const RedoIcon = () => (
  <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
    <path d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
  </svg>
);

const SelectIcon = () => (
  <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
    <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
  </svg>
);

const PanIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" />
  </svg>
);

const ZoomIcon = () => (
  <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
  </svg>
);

const LineIcon = () => (
  <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
    <path d="M5 19L19 5" />
  </svg>
);

const PolygonIcon = () => (
  <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

const RectangleIcon = () => (
  <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </svg>
);

const CircleIcon = () => (
  <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const MeasureIcon = () => (
  <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
    <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

const TextIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
  </svg>
);

const GridIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const GridLinesIcon = () => (
  <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
    <path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
  </svg>
);

const ExportIcon = () => (
  <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
    <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const PreviewIcon = () => (
  <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);
