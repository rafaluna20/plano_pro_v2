'use client';

import { useState, useCallback, useEffect } from 'react';
import { useEditorStore } from '@/lib/editor/store';
import { DrawingTool, Layer } from '@/types/editor';
import { UTMCoordinate } from '@/types/planos';
import { DrawingToolbar } from './DrawingToolbar';
import { LayerPanel } from './LayerPanel';
import { CommandPanel } from './CommandPanel';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function FreeEditor() {
  const {
    activeTool,
    layers,
    selectedLayer,
    snapEnabled,
    gridEnabled,
    vertices,
    addVertex,
    setMode,
  } = useEditorStore();

  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [tempPoints, setTempPoints] = useState<{ x: number; y: number }[]>([]);
  const [showProperties, setShowProperties] = useState(true);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  // Grid settings
  const gridSize = 20;
  const gridColor = isDarkTheme ? 'rgba(51, 65, 85, 0.4)' : 'rgba(100, 116, 139, 0.2)';

  // Snap point to grid
  const snapToGrid = useCallback((x: number, y: number) => {
    if (!snapEnabled) return { x, y };
    
    const snappedX = Math.round(x / gridSize) * gridSize;
    const snappedY = Math.round(y / gridSize) * gridSize;
    
    return { x: snappedX, y: snappedY };
  }, [snapEnabled]);

  // Handle canvas click
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    
    let x = (e.clientX - rect.left - pan.x) / zoom;
    let y = (e.clientY - rect.top - pan.y) / zoom;

    // Snap to grid if enabled
    const snapped = snapToGrid(x, y);
    x = snapped.x;
    y = snapped.y;

    // Handle different tools
    switch (activeTool) {
      case DrawingTool.LINE:
        if (!isDrawing) {
          setTempPoints([{ x, y }]);
          setIsDrawing(true);
          toast.success('Click para terminar línea');
        } else {
          setTempPoints(prev => [...prev, { x, y }]);
          // Complete line with 2 points
          if (tempPoints.length === 1) {
            addVertex([x, y]);
            setIsDrawing(false);
            setTempPoints([]);
            toast.success('Línea creada');
          }
        }
        break;

      case DrawingTool.POLYGON:
        if (!isDrawing) {
          setTempPoints([{ x, y }]);
          setIsDrawing(true);
          toast.success('Click para continuar polígono. ESC para terminar');
        } else {
          setTempPoints(prev => [...prev, { x, y }]);
          addVertex([x, y]);
        }
        break;

      case DrawingTool.RECTANGLE:
        if (!isDrawing) {
          setTempPoints([{ x, y }]);
          setIsDrawing(true);
          toast.success('Click para definir esquina opuesta');
        } else {
          // Create rectangle from 2 corners
          const startPoint = tempPoints[0];
          const rectVertices: UTMCoordinate[] = [
            [startPoint.x, startPoint.y],
            [x, startPoint.y],
            [x, y],
            [startPoint.x, y],
          ];
          rectVertices.forEach(v => addVertex(v));
          setIsDrawing(false);
          setTempPoints([]);
          toast.success('Rectángulo creado');
        }
        break;

      case DrawingTool.CIRCLE:
        if (!isDrawing) {
          setTempPoints([{ x, y }]);
          setIsDrawing(true);
          toast.success('Click para definir radio');
        } else {
          const center = tempPoints[0];
          const radius = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2));
          
          // Create circle with 32 points
          const points: UTMCoordinate[] = [];
          for (let i = 0; i < 32; i++) {
            const angle = (i / 32) * 2 * Math.PI;
            points.push([
              center.x + radius * Math.cos(angle),
              center.y + radius * Math.sin(angle)
            ]);
          }
          points.forEach(v => addVertex(v));
          
          setIsDrawing(false);
          setTempPoints([]);
          toast.success('Círculo creado');
        }
        break;

      default:
        break;
    }
  }, [activeTool, isDrawing, tempPoints, snapToGrid, addVertex, zoom, pan]);

  // Handle mouse move for cursor position
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    
    let x = (e.clientX - rect.left - pan.x) / zoom;
    let y = (e.clientY - rect.top - pan.y) / zoom;

    const snapped = snapToGrid(x, y);
    setCursorPosition({ x: snapped.x, y: snapped.y });
  }, [snapToGrid, zoom, pan]);

  // Detect theme changes
  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsDarkTheme(theme === 'dark');
    };
    
    checkTheme();
    
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    
    return () => observer.disconnect();
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to cancel drawing
      if (e.key === 'Escape') {
        if (isDrawing) {
          setIsDrawing(false);
          setTempPoints([]);
          toast('Dibujo cancelado');
        }
      }

      // ENTER to complete polygon
      if (e.key === 'Enter' && isDrawing && activeTool === DrawingTool.POLYGON) {
        setIsDrawing(false);
        setTempPoints([]);
        toast.success('Polígono completado');
      }

      // Zoom shortcuts
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom(prev => Math.min(prev * 1.2, 5));
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom(prev => Math.max(prev / 1.2, 0.1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing, activeTool]);

  // Draw on canvas
  useEffect(() => {
    const canvas = document.getElementById('drawingCanvas') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context
    ctx.save();

    // Apply zoom and pan
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw grid if enabled
    if (gridEnabled) {
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1 / zoom;
      
      for (let x = 0; x < canvas.width / zoom; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height / zoom);
        ctx.stroke();
      }
      
      for (let y = 0; y < canvas.height / zoom; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width / zoom, y);
        ctx.stroke();
      }
    }

    // Draw existing vertices
    if (vertices.length > 0) {
      ctx.strokeStyle = '#0066CC';
      ctx.fillStyle = 'rgba(0, 102, 204, 0.1)';
      ctx.lineWidth = 2 / zoom;
      
      ctx.beginPath();
      ctx.moveTo(vertices[0][0], vertices[0][1]);
      
      for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i][0], vertices[i][1]);
      }
      
      if (vertices.length > 2) {
        ctx.closePath();
        ctx.fill();
      }
      
      ctx.stroke();

      // Draw vertex points
      vertices.forEach(v => {
        ctx.fillStyle = '#0066CC';
        ctx.beginPath();
        ctx.arc(v[0], v[1], 4 / zoom, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    // Draw temporary points
    if (tempPoints.length > 0) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2 / zoom;
      
      ctx.beginPath();
      ctx.moveTo(tempPoints[0].x, tempPoints[0].y);
      
      for (let i = 1; i < tempPoints.length; i++) {
        ctx.lineTo(tempPoints[i].x, tempPoints[i].y);
      }
      
      ctx.stroke();

      // Draw temp points
      tempPoints.forEach(p => {
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 / zoom, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    // Draw cursor position
    if (snapEnabled) {
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([5 / zoom, 5 / zoom]);
      
      // Crosshair
      ctx.beginPath();
      ctx.moveTo(cursorPosition.x - 10 / zoom, cursorPosition.y);
      ctx.lineTo(cursorPosition.x + 10 / zoom, cursorPosition.y);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(cursorPosition.x, cursorPosition.y - 10 / zoom);
      ctx.lineTo(cursorPosition.x, cursorPosition.y + 10 / zoom);
      ctx.stroke();
      
      ctx.setLineDash([]);
    }

    // Restore context
    ctx.restore();
  }, [vertices, tempPoints, gridEnabled, snapEnabled, cursorPosition, zoom, pan]);

  // Calculate statistics
  const totalElements = layers.reduce((sum, layer) => sum + layer.elements.length, 0);
  const visibleLayers = layers.filter(l => l.visible).length;
  const activeLayer = layers.find(l => l.id === selectedLayer);

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Top Toolbar */}
      <DrawingToolbar />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Layers */}
        <LayerPanel />

        {/* Center Canvas */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 border-x border-slate-200 dark:border-slate-700 transition-colors">
          {/* Canvas Header */}
          <div className="h-10 bg-slate-100 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600 flex items-center justify-between px-4 transition-colors">
            <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
              <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
              <span className="text-slate-300 dark:text-slate-500">|</span>
              <span>Cursor: ({cursorPosition.x.toFixed(1)}, {cursorPosition.y.toFixed(1)})</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(prev => Math.max(prev / 1.2, 0.1))}
                className="px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
              >
                -
              </button>
              <button
                onClick={() => setZoom(1)}
                className="px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
              >
                100%
              </button>
              <button
                onClick={() => setZoom(prev => Math.min(prev * 1.2, 5))}
                className="px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900 relative transition-colors">
            <canvas
              id="drawingCanvas"
              width={canvasSize.width}
              height={canvasSize.height}
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              className="cursor-crosshair bg-white dark:bg-slate-800 shadow-sm"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                margin: '20px auto',
                display: 'block'
              }}
            />
          </div>
        </div>

        {/* Right Panel - Properties */}
        <div
          className={`transition-all duration-300 ease-in-out ${
            showProperties ? 'w-80' : 'w-0'
          } bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden`}
        >
          {/* Toggle Button */}
          <button
            onClick={() => setShowProperties(!showProperties)}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-l-md p-1 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm z-10"
            style={{ right: showProperties ? '320px' : '0' }}
          >
            {showProperties ? (
              <ChevronRight className="w-4 h-4 text-slate-600" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {showProperties && (
            <>
              {/* Properties Header */}
              <div className="h-12 bg-slate-100 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600 flex items-center px-4 transition-colors">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Propiedades</h3>
              </div>

              {/* Properties Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {activeLayer ? (
                  <>
                    {/* Layer Info */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
                        Capa Activa
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Nombre:</span>
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {activeLayer.name}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Tipo:</span>
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {activeLayer.type}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Elementos:</span>
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {activeLayer.elements.length}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Color */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
                        Color
                      </h4>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-10 h-10 rounded border-2 border-slate-300"
                          style={{ backgroundColor: activeLayer.color }}
                        />
                        <input
                          type="color"
                          value={activeLayer.color}
                          onChange={(e) => {
                            toast.success('Color actualizado');
                          }}
                          className="flex-1 h-10 rounded border border-slate-300 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Opacity */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
                        Opacidad: {(activeLayer.opacity * 100).toFixed(0)}%
                      </h4>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={activeLayer.opacity * 100}
                        onChange={(e) => {
                          // Update layer opacity
                        }}
                        className="w-full"
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">
                    Selecciona una capa para ver sus propiedades
                  </div>
                )}

                {/* Drawing Info */}
                {vertices.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
                      Dibujo Actual
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Vértices:</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {vertices.length}
                        </span>
                      </div>
                      {vertices.length >= 3 && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600 dark:text-slate-400">Área:</span>
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {/* Calculate area */}
                              ~0.00 m²
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600 dark:text-slate-400">Perímetro:</span>
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {/* Calculate perimeter */}
                              ~0.00 m
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="h-8 bg-slate-800 dark:bg-slate-950 text-white text-xs flex items-center justify-between px-4 transition-colors">
        <div className="flex items-center gap-4">
          <span className="text-slate-300 dark:text-slate-400">Herramienta:</span>
          <span className="font-medium">{activeTool}</span>
          {isDrawing && (
            <>
              <span className="text-slate-500 dark:text-slate-600">|</span>
              <span className="text-green-400 animate-pulse">● Dibujando...</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>
            Capas: {visibleLayers}/{layers.length}
          </span>
          <span className="text-slate-500 dark:text-slate-600">|</span>
          <span>Elementos: {totalElements}</span>
          <span className="text-slate-500 dark:text-slate-600">|</span>
          <span>
            Grid: <span className={gridEnabled ? 'text-green-400' : 'text-slate-500 dark:text-slate-600'}>
              {gridEnabled ? 'ON' : 'OFF'}
            </span>
          </span>
          <span className="text-slate-500 dark:text-slate-600">|</span>
          <span>
            Snap: <span className={snapEnabled ? 'text-green-400' : 'text-slate-500 dark:text-slate-600'}>
              {snapEnabled ? 'ON' : 'OFF'}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
