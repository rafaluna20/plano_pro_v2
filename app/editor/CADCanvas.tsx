'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { UTMCoordinate } from '@/types/planos';
import { useEditorStore } from '@/lib/editor/store';
import { DrawingTool } from '@/types/editor';
import { useGeometry } from '@/lib/hooks/useGeometry';
import { calculateDistance } from '@/lib/geometry/utmUtils';
import toast from 'react-hot-toast';
import { Target } from 'lucide-react';

interface CADCanvasProps {
  vertices: UTMCoordinate[];
  onVerticesChange?: (vertices: UTMCoordinate[]) => void;
  editable?: boolean;
}

export function CADCanvas({ vertices, onVerticesChange, editable = true }: CADCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const {
    activeTool,
    gridEnabled,
    snapEnabled,
    gridSize: storeGridSize,
    coordinateSystem,
    setActiveTool,
    addVertex,
    updateVertex,
    removeVertex
  } = useEditorStore();

  // Estados del canvas
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 400, y: 300 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [snappedPos, setSnappedPos] = useState<{ x: number; y: number } | null>(null);
  
  // Estados de dibujo
  const [isDrawing, setIsDrawing] = useState(false);
  const [tempPoints, setTempPoints] = useState<UTMCoordinate[]>([]);
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredVertex, setHoveredVertex] = useState<number | null>(null);

  // Cálculos geométricos en tiempo real
  const geometry = useGeometry(vertices);
  
  const gridSize = storeGridSize * 20; // Convertir metros a píxeles (escala)
  const VERTEX_RADIUS = 6;
  const HOVER_RADIUS = 10;

  // Función para convertir coordenadas de canvas a mundo
  const canvasToWorld = useCallback((canvasX: number, canvasY: number): { x: number; y: number } => {
    return {
      x: (canvasX - pan.x) / zoom,
      y: (canvasY - pan.y) / zoom
    };
  }, [pan, zoom]);

  // Función para convertir coordenadas de mundo a canvas
  const worldToCanvas = useCallback((worldX: number, worldY: number): { x: number; y: number } => {
    return {
      x: worldX * zoom + pan.x,
      y: worldY * zoom + pan.y
    };
  }, [pan, zoom]);

  // Snap to grid
  const snapToGrid = useCallback((x: number, y: number): { x: number; y: number } => {
    if (!snapEnabled) return { x, y };
    
    const snappedX = Math.round(x / gridSize) * gridSize;
    const snappedY = Math.round(y / gridSize) * gridSize;
    
    return { x: snappedX, y: snappedY };
  }, [snapEnabled, gridSize]);

  // Dibujar grilla
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!gridEnabled) return;

    ctx.save();
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;

    const startX = Math.floor(-pan.x / zoom / gridSize) * gridSize;
    const endX = Math.ceil((width - pan.x) / zoom / gridSize) * gridSize;
    const startY = Math.floor(-pan.y / zoom / gridSize) * gridSize;
    const endY = Math.ceil((height - pan.y) / zoom / gridSize) * gridSize;

    // Líneas verticales
    for (let x = startX; x <= endX; x += gridSize) {
      const canvasX = x * zoom + pan.x;
      ctx.beginPath();
      ctx.moveTo(canvasX, 0);
      ctx.lineTo(canvasX, height);
      ctx.stroke();
    }

    // Líneas horizontales
    for (let y = startY; y <= endY; y += gridSize) {
      const canvasY = y * zoom + pan.y;
      ctx.beginPath();
      ctx.moveTo(0, canvasY);
      ctx.lineTo(width, canvasY);
      ctx.stroke();
    }

    // Origen
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    const originX = 0 * zoom + pan.x;
    const originY = 0 * zoom + pan.y;
    
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();

    ctx.restore();
  }, [gridEnabled, gridSize, zoom, pan]);

  // Dibujar polígono
  const drawPolygon = useCallback((ctx: CanvasRenderingContext2D, points: UTMCoordinate[], isFinal: boolean = true) => {
    if (points.length === 0) return;

    ctx.save();

    // Dibujar líneas
    ctx.strokeStyle = isFinal ? '#3b82f6' : '#f59e0b';
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();

    const firstPoint = worldToCanvas(points[0][0], points[0][1]);
    ctx.moveTo(firstPoint.x, firstPoint.y);

    for (let i = 1; i < points.length; i++) {
      const point = worldToCanvas(points[i][0], points[i][1]);
      ctx.lineTo(point.x, point.y);
    }

    if (isFinal && points.length >= 3) {
      ctx.closePath();
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.fill();
    }

    ctx.stroke();

    // Dibujar vértices
    points.forEach((vertex, index) => {
      const point = worldToCanvas(vertex[0], vertex[1]);
      
      // Halo si está hover
      if (hoveredVertex === index && editable) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.beginPath();
        ctx.arc(point.x, point.y, HOVER_RADIUS, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Vértice
      ctx.fillStyle = selectedVertex === index ? '#ef4444' : (isFinal ? '#3b82f6' : '#f59e0b');
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, VERTEX_RADIUS, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Número de vértice
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${index + 1}`, point.x, point.y - 15);
    });

    // Dibujar mediciones de lados
    if (isFinal && points.length >= 2) {
      ctx.fillStyle = '#1f2937';
      ctx.font = '11px monospace';
      
      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        
        const distance = calculateDistance(p1, p2);
        const midX = (p1[0] + p2[0]) / 2;
        const midY = (p1[1] + p2[1]) / 2;
        
        const canvasMid = worldToCanvas(midX, midY);
        
        // Fondo blanco para el texto
        const text = `${distance.toFixed(2)}m`;
        const textWidth = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(canvasMid.x - textWidth / 2 - 3, canvasMid.y - 8, textWidth + 6, 16);
        
        // Texto
        ctx.fillStyle = '#059669';
        ctx.fillText(text, canvasMid.x, canvasMid.y);
      }
    }

    ctx.restore();
  }, [worldToCanvas, zoom, hoveredVertex, selectedVertex, editable]);

  // Dibujar cursor
  const drawCursor = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!snappedPos) return;

    ctx.save();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    // Crosshair
    const size = 15;
    ctx.beginPath();
    ctx.moveTo(snappedPos.x - size, snappedPos.y);
    ctx.lineTo(snappedPos.x + size, snappedPos.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(snappedPos.x, snappedPos.y - size);
    ctx.lineTo(snappedPos.x, snappedPos.y + size);
    ctx.stroke();

    ctx.restore();
  }, [snappedPos]);

  // Renderizar canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limpiar
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar grilla
    drawGrid(ctx, canvas.width, canvas.height);

    // Dibujar polígono principal
    drawPolygon(ctx, vertices, true);

    // Dibujar puntos temporales
    if (tempPoints.length > 0) {
      drawPolygon(ctx, tempPoints, false);
      
      // Línea de seguimiento
      if (snappedPos && isDrawing) {
        const lastPoint = worldToCanvas(tempPoints[tempPoints.length - 1][0], tempPoints[tempPoints.length - 1][1]);
        ctx.save();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(snappedPos.x, snappedPos.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Dibujar cursor
    if (snapEnabled && !isPanning) {
      drawCursor(ctx);
    }

    // Información de herramienta
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(10, 10, 200, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.fillText(`Herramienta: ${activeTool}`, 20, 30);
    ctx.restore();

  }, [drawGrid, drawPolygon, drawCursor, vertices, tempPoints, snappedPos, isDrawing, isPanning, snapEnabled, activeTool, worldToCanvas]);

  // Encontrar vértice cercano
  const findNearbyVertex = useCallback((canvasX: number, canvasY: number): number | null => {
    if (!editable) return null;

    for (let i = 0; i < vertices.length; i++) {
      const point = worldToCanvas(vertices[i][0], vertices[i][1]);
      const distance = Math.sqrt(Math.pow(point.x - canvasX, 2) + Math.pow(point.y - canvasY, 2));
      
      if (distance <= HOVER_RADIUS) {
        return i;
      }
    }
    return null;
  }, [vertices, worldToCanvas, editable]);

  // Manejo de mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    // Pan con rueda del mouse o botón medio
    if (activeTool === DrawingTool.PAN || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: canvasX - pan.x, y: canvasY - pan.y });
      return;
    }

    // Selección y arrastre de vértices
    if (activeTool === DrawingTool.SELECT && editable) {
      const nearbyVertex = findNearbyVertex(canvasX, canvasY);
      if (nearbyVertex !== null) {
        setSelectedVertex(nearbyVertex);
        setIsDragging(true);
        return;
      }
    }

    // Dibujo de polígono
    if (activeTool === DrawingTool.POLYGON && editable) {
      const world = canvasToWorld(canvasX, canvasY);
      const snapped = snapToGrid(world.x, world.y);
      const newVertex: UTMCoordinate = [snapped.x, snapped.y];

      if (!isDrawing) {
        setIsDrawing(true);
        setTempPoints([newVertex]);
        toast.success('Click para agregar puntos. Enter para terminar, Esc para cancelar');
      } else {
        setTempPoints(prev => [...prev, newVertex]);
      }
    }

  }, [activeTool, editable, pan, canvasToWorld, snapToGrid, findNearbyVertex, isDrawing]);

  // Manejo de mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    // Actualizar posición del mouse
    const world = canvasToWorld(canvasX, canvasY);
    setMousePos(world);

    const snapped = snapToGrid(world.x, world.y);
    const snappedCanvas = worldToCanvas(snapped.x, snapped.y);
    setSnappedPos(snappedCanvas);

    // Pan
    if (isPanning) {
      setPan({
        x: canvasX - panStart.x,
        y: canvasY - panStart.y
      });
      return;
    }

    // Arrastrar vértice
    if (isDragging && selectedVertex !== null && editable && onVerticesChange) {
      const newVertices = [...vertices];
      newVertices[selectedVertex] = [snapped.x, snapped.y];
      updateVertex(selectedVertex, [snapped.x, snapped.y]);
      onVerticesChange(newVertices);
      return;
    }

    // Detectar hover sobre vértices
    const nearbyVertex = findNearbyVertex(canvasX, canvasY);
    setHoveredVertex(nearbyVertex);

  }, [canvasToWorld, snapToGrid, worldToCanvas, isPanning, panStart, isDragging, selectedVertex, vertices, editable, onVerticesChange, findNearbyVertex, updateVertex]);

  // Manejo de mouse up
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setIsDragging(false);
  }, []);

  // Manejo de rueda del mouse (zoom)
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    // Zoom factor
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.1, Math.min(10, zoom * zoomFactor));

    // Ajustar pan para zoom en posición del mouse
    const worldBefore = canvasToWorld(canvasX, canvasY);
    
    setZoom(newZoom);
    
    // Recalcular pan
    setPan({
      x: canvasX - worldBefore.x * newZoom,
      y: canvasY - worldBefore.y * newZoom
    });

  }, [zoom, canvasToWorld]);

  // Manejo de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape para cancelar
      if (e.key === 'Escape') {
        if (isDrawing) {
          setIsDrawing(false);
          setTempPoints([]);
          toast('Dibujo cancelado');
        }
        setSelectedVertex(null);
      }

      // Enter para completar polígono
      if (e.key === 'Enter' && isDrawing && tempPoints.length >= 3) {
        if (onVerticesChange) {
          onVerticesChange([...vertices, ...tempPoints]);
        }
        tempPoints.forEach(p => addVertex(p));
        setIsDrawing(false);
        setTempPoints([]);
        toast.success(`Polígono completado con ${tempPoints.length} puntos`);
      }

      // Delete para eliminar vértice seleccionado
      if (e.key === 'Delete' && selectedVertex !== null && editable) {
        if (vertices.length > 3) {
          removeVertex(selectedVertex);
          if (onVerticesChange) {
            const newVertices = vertices.filter((_, i) => i !== selectedVertex);
            onVerticesChange(newVertices);
          }
          setSelectedVertex(null);
          toast.success('Vértice eliminado');
        } else {
          toast.error('No se puede eliminar: mínimo 3 vértices requeridos');
        }
      }

      // Reset zoom
      if (e.key === 'Home') {
        setZoom(1);
        setPan({ x: 400, y: 300 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing, tempPoints, selectedVertex, vertices, editable, onVerticesChange, addVertex, removeVertex]);

  // Renderizar en cada cambio
  useEffect(() => {
    render();
  }, [render]);

  // Ajustar tamaño del canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      render();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [render]);
  
  // Manejar wheel event con preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault();
      
      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.max(0.1, Math.min(10, zoom * zoomFactor));
      
      const worldBefore = canvasToWorld(canvasX, canvasY);
      
      setZoom(newZoom);
      setPan({
        x: canvasX - worldBefore.x * newZoom,
        y: canvasY - worldBefore.y * newZoom
      });
    };
    
    canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheelEvent);
  }, [zoom, canvasToWorld]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-gray-50">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="cursor-crosshair"
        style={{ display: 'block' }}
      />
      
      {/* Panel de información */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 text-xs font-mono space-y-1">
        {coordinateSystem.origin && (
          <>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-green-200">
              <Target size={14} className="text-green-600" />
              <span className="text-green-600 font-semibold">Coords. Relativas</span>
            </div>
          </>
        )}
        {mousePos && (
          <>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">X:</span>
              <span className="font-semibold">{mousePos.x.toFixed(2)} m</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Y:</span>
              <span className="font-semibold">{mousePos.y.toFixed(2)} m</span>
            </div>
          </>
        )}
        <div className="h-px bg-gray-200 my-2" />
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Zoom:</span>
          <span className="font-semibold">{(zoom * 100).toFixed(0)}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Grid:</span>
          <span className="font-semibold">{storeGridSize} m</span>
        </div>
        {vertices.length >= 3 && (
          <>
            <div className="h-px bg-gray-200 my-2" />
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Área:</span>
              <span className="font-semibold text-green-600">{geometry.area.toFixed(2)} m²</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Perímetro:</span>
              <span className="font-semibold text-blue-600">{geometry.perimetro.toFixed(2)} m</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Vértices:</span>
              <span className="font-semibold">{vertices.length}</span>
            </div>
          </>
        )}
        {coordinateSystem.origin && (
          <>
            <div className="h-px bg-gray-200 my-2" />
            <div className="text-gray-500 text-[10px]">
              Origen: {coordinateSystem.origin.lat.toFixed(6)}, {coordinateSystem.origin.lng.toFixed(6)}
            </div>
          </>
        )}
      </div>

      {/* Ayuda contextual */}
      {isDrawing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-pulse">
          ✏️ Dibujando polígono - Enter para terminar, Esc para cancelar
        </div>
      )}
      
      {/* Indicador de sistema de coordenadas */}
      {coordinateSystem.origin && !isDrawing && (
        <div className="absolute top-4 right-4 bg-green-500/90 backdrop-blur text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
          <Target size={16} />
          <span>Sistema de Coordenadas Relativas Activo</span>
        </div>
      )}
    </div>
  );
}
