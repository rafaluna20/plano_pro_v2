'use client';

import { useEditorStore } from '@/lib/editor/store';
import { useGeometry } from '@/lib/hooks/useGeometry';

interface StatusBarProps {
  mouseCoords?: { x: number; y: number };
}

export function StatusBar({ mouseCoords }: StatusBarProps) {
  const { 
    vertices, 
    gridSize,
    snapEnabled,
    gridEnabled,
    mode,
    zoom,
    canUndo,
    canRedo,
    history
  } = useEditorStore();
  
  // Calcular geometría en tiempo real
  const geometria = useGeometry(vertices);
  
  // Formatear coordenadas
  const formatCoord = (value: number) => {
    return value.toFixed(2).padStart(10, ' ');
  };

  return (
    <div className="h-8 bg-gray-50 border-t border-gray-200 flex items-center justify-between px-4 text-xs font-mono shadow-inner">
      {/* Información de Geometría */}
      <div className="flex gap-4 text-gray-700">
        <span className="flex items-center gap-1">
          <span className="font-semibold text-blue-600">V:</span>
          {vertices.length}
        </span>
        
        {vertices.length >= 3 && (
          <>
            <div className="w-px h-4 bg-gray-300" />
            <span className="flex items-center gap-1">
              <span className="font-semibold text-green-600">A:</span>
              {geometria.area.toFixed(2)} m²
            </span>
            <span className="flex items-center gap-1">
              <span className="font-semibold text-purple-600">P:</span>
              {geometria.perimetro.toFixed(2)} ml
            </span>
          </>
        )}
      </div>
      
      {/* Coordenadas del Mouse */}
      <div className="flex gap-3 text-gray-600">
        {mouseCoords ? (
          <>
            <span className="flex items-center gap-1">
              <span className="text-gray-400">X:</span>
              <span className="text-gray-800 font-medium">{formatCoord(mouseCoords.x)}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-gray-400">Y:</span>
              <span className="text-gray-800 font-medium">{formatCoord(mouseCoords.y)}</span>
            </span>
          </>
        ) : (
          <span className="text-gray-400">Mover mouse sobre canvas...</span>
        )}
      </div>
      
      {/* Configuración y Estado */}
      <div className="flex gap-4 items-center text-gray-600">
        <span className="flex items-center gap-1">
          <span className="text-gray-400">Modo:</span>
          <span className="text-blue-700 font-medium uppercase text-[10px]">{mode || 'N/A'}</span>
        </span>
        
        <div className="w-px h-4 bg-gray-300" />
        
        <span className={`flex items-center gap-1 ${snapEnabled ? 'text-blue-600' : 'text-gray-400'}`}>
          <span className="font-bold">S:</span>
          {snapEnabled ? 'ON' : 'OFF'}
        </span>
        
        <span className={`flex items-center gap-1 ${gridEnabled ? 'text-blue-600' : 'text-gray-400'}`}>
          <span className="font-bold">G:</span>
          {gridEnabled ? `${gridSize}m` : 'OFF'}
        </span>
        
        <div className="w-px h-4 bg-gray-300" />
        
        <span className="flex items-center gap-1">
          <span className="text-gray-400">Zoom:</span>
          <span className="text-gray-800 font-medium">{(zoom * 100).toFixed(0)}%</span>
        </span>
        
        <div className="w-px h-4 bg-gray-300" />
        
        <span className="flex items-center gap-1">
          <span className="text-gray-400">Historial:</span>
          <span className={`font-medium ${canUndo() ? 'text-green-600' : 'text-gray-400'}`}>
            {history.past.length}
          </span>
          <span className="text-gray-400">/</span>
          <span className={`font-medium ${canRedo() ? 'text-green-600' : 'text-gray-400'}`}>
            {history.future.length}
          </span>
        </span>
      </div>
    </div>
  );
}
