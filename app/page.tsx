'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic'; // Necesario para Leaflet en Next.js
import {
  MapPin,
  Plus,
  Trash2,
  RefreshCw,
  Download,
  Layout,
  LayoutDashboard,
  MousePointer2,
  Maximize,
  AlertCircle,
  FileText,
  PenTool,
  Layers,
  Globe,
  Eye,
  Upload,
  Search,
  Loader2
} from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PDFViewerWrapper } from '@/components/planos/PDFViewerWrapper';
// Nota: LocationSearch se reemplaza por el buscador integrado de OSM
import { ImportDataModal } from '@/components/planos/ImportDataModal';
import { NeighborEditModal } from '@/components/planos/NeighborEditModal';
import { useAuth } from '@/lib/hooks/useAuth';
import proj4 from 'proj4';
import { Toaster, toast } from 'react-hot-toast';
import { UTMCoordinate } from '@/types/planos';

// --- LEAFLET: IMPORTACIÓN DINÁMICA (Evita error 'window is not defined') ---
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Polygon = dynamic(() => import('react-leaflet').then(m => m.Polygon), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });

// Componente MapUpdater debe importarse dinámicamente como un componente completo
const MapUpdaterComponent = dynamic(
  () => import('react-leaflet').then(mod => {
    const { useMap } = mod;
    return function MapUpdater({ center }: { center: [number, number] }) {
      const map = useMap();
      React.useEffect(() => {
        if (center && map) {
          try {
            map.setView(center, 18);
          } catch (e) {
            console.error('Error actualizando vista del mapa:', e);
          }
        }
      }, [center, map]);
      return null;
    };
  }),
  { ssr: false }
);

// --- CONFIGURACIÓN DE PROYECCIONES ---
const WGS84 = 'EPSG:4326';
const UTM_18S = '+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs';

// --- TIPOS DE DATOS ---
interface Vertice {
  id: string;
  x: number;
  y: number;
}

interface LoteVecino {
  id: string;
  nombre: string;
  vertices: Vertice[];
  codigo?: string;
  estado?: string;
}

interface MembreteData {
  proyecto: string;
  plano: string;
  profesional: string;
  registro: string;
  fecha: string;
  lamina: string;
  escala: string;
}

interface LoteData {
  loteId: string;
  propietario: string;
  dimensiones: {
    frente: number;
    fondo: number;
    izquierda: number;
    derecha: number;
    area: number;
  };
  colindantes: {
    frente: string;
    fondo: string;
    izquierda: string;
    derecha: string;
  };
  membrete: MembreteData;
  vertices: Vertice[];
  contexto: {
    vecinos: LoteVecino[];
  };
  config: {
    modoUbicacion: 'vectorial' | 'satelital' | 'imagen';
  };
}

// --- ESTADO INICIAL ---
const INITIAL_DATA: LoteData = {
  loteId: "MZ-C-Lote14",
  propietario: "Inversiones Santa Rosa S.A.C.",
  dimensiones: {
    frente: 0,
    fondo: 0,
    izquierda: 0,
    derecha: 0,
    area: 0
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
        codigo: "MZ-C-Lote13",
        estado: "libre",
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
        codigo: "MZ-C-Lote15",
        estado: "libre",
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
    modoUbicacion: 'vectorial'
  }
};

// --- HELPERS GEOMÉTRICOS ---

// Fix Icono Leaflet - Crear función para crear el icono en el cliente
const getCustomIcon = () => {
  if (typeof window === 'undefined') return undefined;
  
  const L = require('leaflet');
  return new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

// Conversión UTM -> LatLng para Leaflet
const utmToLatLng = (x: number, y: number): [number, number] => {
  try {
    const [lng, lat] = proj4(UTM_18S, WGS84, [x, y]);
    if (isNaN(lat) || isNaN(lng)) return [0, 0];
    return [lat, lng];
  } catch (e) {
    return [0, 0];
  }
};

// --- CÁLCULO DE ÁREA CORREGIDO (SHOELACE FORMULA) ---
const calculatePolygonArea = (vertices: Vertice[]): number => {
  if (vertices.length < 3) return 0;
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // Suma de productos cruzados: (Xi * Yi+1) - (Xi+1 * Yi)
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  // Dividir por 2 y valor absoluto
  return Number((Math.abs(area) / 2.0).toFixed(2));
};

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = ((angleInDegrees || 0) - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
};

const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
  if (isNaN(x) || isNaN(y) || isNaN(startAngle) || isNaN(endAngle)) return "";
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  let largeArcFlag = "0";
  let diff = endAngle - startAngle;
  while (diff < 0) diff += 360;
  while (diff >= 360) diff -= 360;
  if (diff > 180) largeArcFlag = "1";
  return ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y, "L", x, y, "Z"].join(" ");
};

const getGridStep = (range: number) => {
  if (!range || range <= 0 || !isFinite(range)) return 5;
  const targetSteps = 5;
  const rawStep = range / targetSteps;
  const power = Math.floor(Math.log10(rawStep));
  const base = rawStep / Math.pow(10, power);
  let niceBase = 1;
  if (base > 5) niceBase = 10;
  else if (base > 2) niceBase = 5;
  else if (base > 1) niceBase = 2;
  const step = niceBase * Math.pow(10, power);
  return (isFinite(step) && step > 0) ? step : 5;
};

export default function EditorPlanos() {
  const router = useRouter();
  const { apiKey } = useAuth();

  // Cargar CSS de Leaflet dinámicamente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      
      // Verificar si ya existe antes de agregar
      const existingLink = document.querySelector('link[href*="leaflet.css"]');
      if (!existingLink) {
        document.head.appendChild(link);
      }
    }
  }, []);

  // Estados principales
  const [data, setData] = useState<LoteData>(INITIAL_DATA);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'membrete' | 'contexto' | 'vertices'>('general');
  const [hoveredVertexId, setHoveredVertexId] = useState<string | null>(null);
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);
  
  // Modales y Vistas
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showNeighborsImportModal, setShowNeighborsImportModal] = useState(false);
  const [selectedNeighbor, setSelectedNeighbor] = useState<LoteVecino | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Estados para Búsqueda (OSM)
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // --- AUTO-CALCULO DE ÁREA ---
  useEffect(() => {
    const newArea = calculatePolygonArea(data.vertices);
    // Solo actualizamos si cambia significativamente para evitar loops
    if (Math.abs(newArea - data.dimensiones.area) > 0.01 && data.vertices.length >= 3) {
      setData(prev => ({
        ...prev,
        dimensiones: { ...prev.dimensiones, area: newArea }
      }));
    }
  }, [data.vertices]);

  // --- HANDLERS ---
  const handleImportVertices = (newCoords: UTMCoordinate[]) => {
    const newVertices: Vertice[] = newCoords.map((coord, index) => ({
      id: String.fromCharCode(65 + (index % 26)) + (index >= 26 ? Math.floor(index / 26) : ''),
      x: coord[0],
      y: coord[1]
    }));
    setData(prev => ({ ...prev, vertices: newVertices }));
  };

  const handleImportNeighbors = (newCoords: UTMCoordinate[]) => {
    const nextIdx = data.contexto.vecinos.length + 1;
    const newNeighbor: LoteVecino = {
      id: `V${nextIdx}`,
      nombre: `Lote Vecino ${nextIdx}`,
      codigo: `MZ-AUTO-${nextIdx}`,
      estado: 'libre',
      vertices: newCoords.map((coord, index) => ({
        id: (index + 1).toString(),
        x: coord[0],
        y: coord[1]
      }))
    };
    setData(prev => ({
      ...prev,
      contexto: { ...prev.contexto, vecinos: [...prev.contexto.vecinos, newNeighbor] }
    }));
  };

  const handleSaveNeighbor = (updatedNeighbor: LoteVecino) => {
    setData(prev => ({
      ...prev,
      contexto: {
        ...prev.contexto,
        vecinos: prev.contexto.vecinos.map(v => v.id === updatedNeighbor.id ? updatedNeighbor : v)
      }
    }));
    setSelectedNeighbor(null);
  };

  const handleDeleteNeighbor = (neighborId: string) => {
    setData(prev => ({
      ...prev,
      contexto: {
        ...prev.contexto,
        vecinos: prev.contexto.vecinos.filter(v => v.id !== neighborId)
      }
    }));
    setSelectedNeighbor(null);
  };






  // --- BÚSQUEDA OPENSTREETMAP (Nominatim) ---
  const handleSearchOSM = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const results = await response.json();
      
      if (results && results.length > 0) {
        const lat = parseFloat(results[0].lat);
        const lng = parseFloat(results[0].lon);
        handleLocationSelect(lat, lng);
        toast.success(`Ubicación encontrada: ${results[0].display_name.split(',')[0]}`);
      } else {
        toast.error("No se encontraron resultados.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error al conectar con el servicio de búsqueda.");
    } finally {
      setIsSearching(false);
    }
  };







  
  // --- TRASLACIÓN GEOMÉTRICA ---
  const handleLocationSelect = (lat: number, lng: number) => {
    try {
      const [newUtmX, newUtmY] = proj4(WGS84, UTM_18S, [lng, lat]);

      // Calcular centroide actual
      let currentCx = 0, currentCy = 0;
      data.vertices.forEach(v => { currentCx += v.x; currentCy += v.y; });
      currentCx /= data.vertices.length;
      currentCy /= data.vertices.length;

      const deltaX = newUtmX - currentCx;
      const deltaY = newUtmY - currentCy;

      const newVertices = data.vertices.map(v => ({
        ...v,
        x: parseFloat((v.x + deltaX).toFixed(2)),
        y: parseFloat((v.y + deltaY).toFixed(2))
      }));

      const newVecinos = data.contexto.vecinos.map(vecino => ({
        ...vecino,
        vertices: vecino.vertices.map(v => ({
          ...v,
          x: parseFloat((v.x + deltaX).toFixed(2)),
          y: parseFloat((v.y + deltaY).toFixed(2))
        }))
      }));

      setData(prev => ({
        ...prev,
        vertices: newVertices,
        contexto: { ...prev.contexto, vecinos: newVecinos }
      }));
    } catch (error) {
      console.error('Error en traslación geométrica:', error);
      toast.error('Error al trasladar las coordenadas.');
    }
  };

  // --- LÓGICA DE RENDERIZADO ---
  const previewData = useMemo(() => {
    try {
      const { vertices } = data;
      if (!vertices || vertices.length < 3) return null;

      // Límites
      let allVertices = [...vertices];
      if (data.config.modoUbicacion === 'vectorial') {
        data.contexto.vecinos.forEach(v => allVertices.push(...v.vertices));
      }

      const xValues = allVertices.map(v => v.x);
      const yValues = allVertices.map(v => v.y);
      const minX = Math.min(...xValues);
      const maxX = Math.max(...xValues);
      const minY = Math.min(...yValues);
      const maxY = Math.max(...yValues);

      const deltaX = Math.abs(maxX - minX) < 0.001 ? 1 : (maxX - minX);
      const deltaY = Math.abs(maxY - minY) < 0.001 ? 1 : (maxY - minY);
      const maxDim = Math.max(deltaX, deltaY);
      const gridStep = getGridStep(maxDim);

      const viewMinX = Math.floor(minX / gridStep) * gridStep;
      const viewMaxX = Math.ceil(maxX / gridStep) * gridStep;
      const viewMinY = Math.floor(minY / gridStep) * gridStep;
      const viewMaxY = Math.ceil(maxY / gridStep) * gridStep;

      const viewDeltaX = Math.abs(viewMaxX - viewMinX) < 0.001 ? gridStep : (viewMaxX - viewMinX);
      const viewDeltaY = Math.abs(viewMaxY - viewMinY) < 0.001 ? gridStep : (viewMaxY - viewMinY);

      // Dimensiones render
      const width = 900;
      const height = 600;
      const margin = 20;
      const rect1 = { x: margin, y: margin, w: width - (margin * 2), h: height - (margin * 2) };
      const rightColWidth = 280;
      const leftColWidth = Math.max(100, rect1.w - rightColWidth - 20);
      const rect2 = { x: rect1.x, y: rect1.y, w: leftColWidth, h: rect1.h }; 
      const rect3 = { x: rect1.x + leftColWidth + 20, y: rect1.y, w: rightColWidth, h: rect1.h };

      const padding = 60;
      const availableW = Math.max(10, rect2.w - (padding * 2));
      const availableH = Math.max(10, rect2.h - (padding * 2));

      const scaleX = availableW / viewDeltaX;
      const scaleY = availableH / viewDeltaY;
      const scale = Math.min(scaleX, scaleY);

      const drawW = viewDeltaX * scale;
      const drawH = viewDeltaY * scale;
      const offsetX = rect2.x + (rect2.w - drawW) / 2;
      const offsetY = rect2.y + (rect2.h - drawH) / 2;

      // Transformaciones
      const toScreen = (x: number, y: number) => {
        const sx = (x - viewMinX) * scale + offsetX;
        const sy = (offsetY + drawH) - ((y - viewMinY) * scale);
        return { x: isFinite(sx) ? sx : 0, y: isFinite(sy) ? sy : 0 };
      };

      const screenToWorld = (screenX: number, screenY: number) => {
        const x_utm = ((screenX - offsetX) / scale) + viewMinX;
        const y_utm = ((offsetY + drawH - screenY) / scale) + viewMinY;
        return { x: x_utm, y: y_utm };
      };

      // Puntos
      const points = vertices.map(v => {
        const s = toScreen(v.x, v.y);
        return { x: s.x, y: s.y, label: v.id, rawX: v.x, rawY: v.y };
      });
      const polygonPoints = points.map(p => `${p.x},${p.y}`).join(" ");

      // Vecinos
      const neighborsPolygons = data.contexto.vecinos.map(vecino => {
        return vecino.vertices.map(v => {
          const p = toScreen(v.x, v.y);
          return `${p.x},${p.y}`;
        }).join(" ");
      });

      // Grilla
      const gridLines = [];
      const maxGridLines = 50;
      let count = 0;
      for (let x = viewMinX; x <= viewMaxX; x += gridStep) {
        if (count++ > maxGridLines) break;
        const pStart = toScreen(x, viewMinY);
        const pEnd = toScreen(x, viewMaxY);
        gridLines.push({ type: 'v', x1: pStart.x, y1: pStart.y, x2: pEnd.x, y2: pEnd.y, label: x.toFixed(0) });
      }
      count = 0;
      for (let y = viewMinY; y <= viewMaxY; y += gridStep) {
        if (count++ > maxGridLines) break;
        const pStart = toScreen(viewMinX, y);
        const pEnd = toScreen(viewMaxX, y);
        gridLines.push({ type: 'h', x1: pStart.x, y1: pStart.y, x2: pEnd.x, y2: pEnd.y, label: y.toFixed(0) });
      }

      // Cálculos geométricos
      let signedArea = 0;
      let centerX = 0, centerY = 0;
      let totalPerimeter = 0;

      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        signedArea += (p2.x - p1.x) * (p2.y + p1.y);
        centerX += p1.x; centerY += p1.y;
      }
      centerX /= points.length; centerY /= points.length;
      const isClockwise = signedArea < 0;

      const technicalData = points.map((p, i) => {
        const nextIndex = (i + 1) % points.length;
        const prevIndex = (i - 1 + points.length) % points.length;
        const prevP = points[prevIndex];
        const nextP = points[nextIndex];
        const rawP = vertices[i];
        const rawNext = vertices[nextIndex];

        const dist = Math.sqrt(Math.pow(rawNext.x - rawP.x, 2) + Math.pow(rawNext.y - rawP.y, 2));
        totalPerimeter += dist;

        const angleToPrev = Math.atan2(prevP.y - p.y, prevP.x - p.x) * (180 / Math.PI);
        const angleToNext = Math.atan2(nextP.y - p.y, nextP.x - p.x) * (180 / Math.PI);
        const normPrev = (angleToPrev + 360) % 360;
        const normNext = (angleToNext + 360) % 360;

        let angleInternal = 0, startArc = 0, endArc = 0;
        if (isClockwise) {
          let diff = normPrev - normNext;
          if (diff < 0) diff += 360;
          angleInternal = diff;
          startArc = normNext + 90; endArc = normPrev + 90;
        } else {
          let diff = normNext - normPrev;
          if (diff < 0) diff += 360;
          angleInternal = diff;
          startArc = normPrev + 90; endArc = normNext + 90;
        }

        const arcPath = describeArc(p.x, p.y, 20, startArc, endArc);
        let bisectorAngle = startArc + (angleInternal / 2);
        if (endArc < startArc) bisectorAngle = startArc + ((360 - startArc + endArc) / 2);
        const labelPos = polarToCartesian(p.x, p.y, 32, bisectorAngle);
        const midX = (p.x + nextP.x) / 2;
        const midY = (p.y + nextP.y) / 2;

        return {
          vertex: p.label,
          side: `${p.label}-${points[nextIndex].label}`,
          dist: dist.toFixed(2),
          angle: angleInternal.toFixed(2),
          arcPath,
          screen: { x: p.x, y: p.y, midX, midY, labelX: labelPos.x, labelY: labelPos.y },
          raw: { x: rawP.x.toFixed(2), y: rawP.y.toFixed(2) }
        };
      });

      // Mini mapa ubicación
      const locMapH = 180;
      const locMapW = rect3.w;
      const locMapX = rect3.x;
      const locMapY = rect3.y + 20;

      const contextBuffer = Math.max(deltaX, deltaY) * 2;
      const locScaleX = locMapW / (deltaX + contextBuffer);
      const locScaleY = locMapH / (deltaY + contextBuffer);
      const locScale = Math.min(locScaleX, locScaleY) || 0.1;

      const centerRawX = (minX + maxX) / 2;
      const centerRawY = (minY + maxY) / 2;

      const toLocScreen = (x: number, y: number) => ({
        x: locMapX + (locMapW / 2) + (x - centerRawX) * locScale,
        y: locMapY + (locMapH / 2) - (y - centerRawY) * locScale
      });

      const locPolyPoints = vertices.map(v => {
        const p = toLocScreen(v.x, v.y);
        return `${p.x},${p.y}`;
      }).join(" ");

      const blockMargin = Math.max(deltaX, deltaY) * 1.2;
      const bMin = toLocScreen(minX - blockMargin / 2, maxY + blockMargin / 2);
      const bMax = toLocScreen(maxX + blockMargin / 2, minY - blockMargin / 2);

      const block = {
        x: Math.min(bMin.x, bMax.x),
        y: Math.min(bMin.y, bMax.y),
        w: Math.abs(bMax.x - bMin.x),
        h: Math.abs(bMax.y - bMin.y)
      };

      const tableStartY = locMapY + locMapH + 40;
      const membreteH = 110;
      const membreteY = rect3.y + rect3.h - membreteH;
      
      // Datos para Leaflet
      const leafletCenter = utmToLatLng(centerRawX, centerRawY);
      const leafletPolygon = vertices.map(v => utmToLatLng(v.x, v.y));

      return {
        layout: { width, height, rect2, rect3 },
        points, polygonPoints, neighborsPolygons, gridLines, technicalData,
        centerLabel: { x: centerX, y: centerY, perimeter: totalPerimeter.toFixed(2) },
        elements: {
          locMap: { x: locMapX, y: locMapY, w: locMapW, h: locMapH, polyPoints: locPolyPoints, block },
          table: { x: rect3.x, y: tableStartY, w: rect3.w },
          membrete: { x: rect3.x, y: membreteY, w: rect3.w, h: membreteH }
        },
        screenToWorld,
        leaflet: { center: leafletCenter, polygon: leafletPolygon }
      };
    } catch (e) {
      console.error("Error calculando geometría:", e);
      return null;
    }
  }, [data]);

  // Handlers UI
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingVertexIndex !== null && svgRef.current && previewData) {
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const newCoords = previewData.screenToWorld(mouseX, mouseY);

      const newVertices = [...data.vertices];
      newVertices[draggingVertexIndex] = { ...newVertices[draggingVertexIndex], x: Number(newCoords.x.toFixed(2)), y: Number(newCoords.y.toFixed(2)) };
      setData(prev => ({ ...prev, vertices: newVertices }));
    }
  };

  const handleInputChange = (section: 'dimensiones' | 'colindantes', field: string, value: string | number) => {
    setData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as Record<string, any>),
        [field]: value
      }
    }));
  };
  const handleMembreteChange = (field: keyof MembreteData, value: string) => {
    setData(prev => ({ ...prev, membrete: { ...prev.membrete, [field]: value } }));
  };
  const handleRootChange = (field: keyof LoteData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };
  const handleVertexChange = (index: number, field: keyof Vertice, value: string) => {
    const newVertices = [...data.vertices];
    newVertices[index] = { ...newVertices[index], [field]: field === 'id' ? value : parseFloat(value) || 0 };
    setData(prev => ({ ...prev, vertices: newVertices }));
  };
  const addVertex = () => {
    const lastV = data.vertices[data.vertices.length - 1];
    const newId = String.fromCharCode(lastV.id.charCodeAt(0) + 1);
    setData(prev => ({ ...prev, vertices: [...prev.vertices, { id: newId, x: lastV.x + 5, y: lastV.y }] }));
  };
  const removeVertex = (index: number) => {
    if (data.vertices.length <= 3) return;
    const newVertices = data.vertices.filter((_, i) => i !== index);
    setData(prev => ({ ...prev, vertices: newVertices }));
  };
  const setModoUbicacion = (modo: 'vectorial' | 'satelital' | 'imagen') => {
    setData(prev => ({ ...prev, config: { ...prev.config, modoUbicacion: modo } }));
  };
  
  const handleGeneratePDF = async () => {
    if (data.vertices.length < 3) {
      toast.error('Se requieren al menos 3 vértices para generar el PDF');
      return;
    }

    setLoading(true);
    
    try {
      // Extraer parte numérica del loteId
      const loteMatch = data.loteId.match(/\d+/);
      const manzanaMatch = data.loteId.match(/MZ-([A-Z])/i);
      
      // Construir payload en formato híbrido (PlanoPayloadHibrido)
      const hybridPayload = {
        // Metadatos
        meta: {
          solicitudId: `WEB-${Date.now()}`,
          fechaSolicitud: new Date().toISOString(),
          solicitante: data.propietario || "Usuario Web"
        },

        // Lote objetivo (GeoJSON Feature)
        loteObjetivo: {
          type: "Feature" as const,
          properties: {
            identificador: {
              manzana: manzanaMatch ? manzanaMatch[1] : "A",
              lote: loteMatch ? loteMatch[0] : "01",
              urbanizacion: data.membrete.proyecto || "Urbanización"
            },
            comercial: {
              nombreComercial: `Lote ${loteMatch ? loteMatch[0] : data.loteId}`
            },
            ubicacion: {
              direccion: data.colindantes.frente || "Sin dirección",
              distrito: "Lima",
              provincia: "Lima",
              departamento: "Lima"
            },
            titularidad: {
              nombre: data.propietario || "Sin especificar",
              documento: {
                tipo: "DNI" as const,
                numero: "00000000"
              }
            }
          },
          geometry: {
            type: "Polygon" as const,
            coordinates: [[
              ...data.vertices.map(v => [v.x, v.y] as [number, number]),
              [data.vertices[0].x, data.vertices[0].y] // Cerrar polígono
            ]]
          }
        },

        // Datos registrales (construir desde formulario)
        datosRegistrales: {
          areaOficial: data.dimensiones.area, // Usar área del formulario
          perimetroOficial: null, // Calcular desde linderos
          // Generar linderos dinámicamente basado en vértices
          linderos: data.vertices.map((v, i) => {
            const nextIndex = (i + 1) % data.vertices.length;
            
            // Mapear el índice a lado específico para polígonos de 4 lados
            let longitudTexto = "0.00";
            let colindanciaTexto = "Sin especificar";
            let orientacion: "FRENTE" | "DERECHA" | "FONDO" | "IZQUIERDA" = "FRENTE";
            
            if (data.vertices.length === 4) {
              // Para polígonos rectangulares (4 lados)
              const mapping = [
                { dist: data.dimensiones.frente, col: data.colindantes.frente, ori: "FRENTE" as const },
                { dist: data.dimensiones.derecha, col: data.colindantes.derecha, ori: "DERECHA" as const },
                { dist: data.dimensiones.fondo, col: data.colindantes.fondo, ori: "FONDO" as const },
                { dist: data.dimensiones.izquierda, col: data.colindantes.izquierda, ori: "IZQUIERDA" as const }
              ];
              
              if (mapping[i]) {
                longitudTexto = mapping[i].dist.toFixed(2);
                colindanciaTexto = mapping[i].col || "Sin especificar";
                orientacion = mapping[i].ori;
              }
            } else {
              // Para otros polígonos, calcular distancia real
              const v1 = data.vertices[i];
              const v2 = data.vertices[nextIndex];
              const dist = Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2));
              longitudTexto = dist.toFixed(2);
              colindanciaTexto = `Lado ${i + 1}`;
              orientacion = "FRENTE";
            }
            
            return {
              index: i,
              tramo: `V${i + 1} - V${nextIndex + 1}`,
              longitudTexto,
              colindanciaTexto,
              orientacion
            };
          })
        },

        // Contexto geoespacial (lotes vecinos)
        contexto: {
          type: "FeatureCollection" as const,
          features: data.contexto.vecinos.map(vecino => ({
            type: "Feature" as const,
            properties: {
              tipo: "lote" as const,
              numeroLote: vecino.nombre.match(/\d+/)?.[0] || vecino.id,
              estado: vecino.estado || "libre"
            },
            geometry: {
              type: "Polygon" as const,
              coordinates: [[
                ...vecino.vertices.map(v => [v.x, v.y] as [number, number]),
                [vecino.vertices[0].x, vecino.vertices[0].y] // Cerrar polígono
              ]]
            }
          }))
        },

        // Configuración de impresión
        configImpresion: {
          formatoPapel: "a3" as const,
          orientacion: "landscape" as const,
          incluirNorte: true,
          incluirEscala: true,
          estilos: {
            colorLotePrincipal: "#000000",
            colorVecinos: "#CCCCCC"
          }
        }
      };

      console.log('📤 Enviando payload híbrido:', hybridPayload);

      // Enviar al nuevo endpoint híbrido
      const response = await fetch('/api/v1/planos/generar-hibrido', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(hybridPayload)
      });

      // Verificar si la respuesta es exitosa
      if (!response.ok) {
        // Si es 400, leer el JSON de error
        if (response.status === 400) {
          const errorData = await response.json();
          toast.error(errorData.error?.message || 'Error de validación');
          console.error('Error 400:', errorData);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Leer headers informativos
      const dataSourceArea = response.headers.get('X-Data-Source-Area');
      const dataSourceLinderos = response.headers.get('X-Data-Source-Linderos');
      const requiresReview = response.headers.get('X-Requires-Review');
      const genTime = response.headers.get('X-Generation-Time');

      console.log('📊 Metadata de generación:', {
        dataSourceArea,
        dataSourceLinderos,
        requiresReview,
        genTime: genTime ? `${genTime}ms` : 'N/A'
      });

      // Respuesta es PDF binario
      const pdfBlob = await response.blob();
      
      // Crear URL temporal y descargar
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `plano_${data.loteId}_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Mensajes de éxito con información adicional
      toast.success('¡PDF generado exitosamente!');
      
      if (dataSourceArea === 'CALCULADO') {
        toast.success('📐 Área calculada automáticamente desde geometría', { duration: 3000 });
      }
      
      if (requiresReview === 'true') {
        toast('⚠️ El plano requiere revisión manual (ver headers)', {
          icon: '⚠️',
          duration: 5000
        });
      }

      toast.success(`⏱️ Generado en ${genTime || '?'}ms`, { duration: 2000 });

    } catch (error) {
      console.error('❌ Error al generar PDF:', error);
      toast.error('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800">

        {/* HEADER */}
        <header className="max-w-[1400px] mx-auto mb-6 flex flex-col md:flex-row justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="text-blue-800" />
              Editor de Catastro Urbano
            </h1>
            <p className="text-slate-500 text-sm mt-1">Generación de Planos Perimétricos y Memorias Descriptivas</p>
          </div>
          <div className="flex gap-3 mt-4 md:mt-0">
            <button onClick={() => router.push('/dashboard')} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-2 transition-colors">
              <LayoutDashboard size={16} /> Dashboard
            </button>
            <button
              onClick={() => router.push('/editor')}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md flex items-center gap-2 transition-transform active:scale-95"
            >
              <PenTool size={16} /> CAD Pro
            </button>
            <button
              onClick={() => setShowPDFViewer(!showPDFViewer)}
              className={`px-4 py-2 text-sm font-medium text-white ${showPDFViewer ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'} rounded-lg shadow-md flex items-center gap-2 transition-transform active:scale-95`}
            >
              {showPDFViewer ? <><Maximize size={16} /> Vista SVG</> : <><FileText size={16} /> viewPDF</>}
            </button>
            <button onClick={handleGeneratePDF} disabled={loading} className="px-6 py-2 text-sm font-medium text-white bg-blue-800 hover:bg-blue-900 rounded-lg shadow-md flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
              {loading ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <Download size={18} />}
              {loading ? 'Procesando...' : 'Exportar PDF'}
            </button>
          </div>
        </header>

        <main className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* PANEL IZQUIERDO */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[650px]">

              {/* TABS DE NAVEGACIÓN */}
              <div className="flex border-b border-slate-200 bg-slate-50">
                {[
                  { id: 'general', icon: Layout, label: 'General' },
                  { id: 'membrete', icon: FileText, label: 'Membrete' },
                  { id: 'contexto', icon: Layers, label: 'Contexto' },
                  { id: 'vertices', icon: PenTool, label: 'Vértices' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-3 flex flex-col lg:flex-row justify-center items-center gap-1 text-[10px] lg:text-xs font-semibold transition-colors 
                    ${activeTab === tab.id
                        ? 'bg-white text-blue-800 border-t-2 border-blue-800 shadow-sm z-10'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}
                  `}
                  >
                    <tab.icon size={14} /> {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6 overflow-y-auto flex-1">

                {/* 1. GENERAL */}
                {activeTab === 'general' && (
                  <div className="space-y-6 animate-fadeIn">

                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Identificación</h3>
                      <div><label className="block text-xs font-semibold text-slate-600 mb-1">Código Lote</label><input type="text" value={data.loteId} onChange={(e) => handleRootChange('loteId', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-800" /></div>
                      <div><label className="block text-xs font-semibold text-slate-600 mb-1">Propietario</label><input type="text" value={data.propietario} onChange={(e) => handleRootChange('propietario', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-800" /></div>
                      
                      {/* AREA: Mostrar valor calculado */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Área Calculada (m²)</label>
                        <div className="flex gap-2 items-center">
                          <input type="number" value={data.dimensiones.area} readOnly className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-md text-sm text-slate-500 cursor-not-allowed" />
                          <span title="Calculado automáticamente">
                            <RefreshCw size={16} className="text-slate-400" />
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pt-4 border-t border-slate-100">Colindancias</h3>
                      {['frente', 'fondo', 'izquierda', 'derecha'].map((lado) => (
                        <div key={lado} className="space-y-1">
                          <label className="block text-xs font-semibold text-blue-800 capitalize">{lado}</label>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-1 relative"><input type="number" value={data.dimensiones[lado as keyof typeof data.dimensiones]} onChange={(e) => handleInputChange('dimensiones', lado, parseFloat(e.target.value))} className="w-full px-2 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md" placeholder="0.00" /><span className="absolute right-2 top-2 text-xs text-slate-400">m</span></div>
                            <div className="col-span-2"><input type="text" placeholder="Colindante..." value={data.colindantes[lado as keyof typeof data.colindantes]} onChange={(e) => handleInputChange('colindantes', lado, e.target.value)} className="w-full px-2 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md" /></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. MEMBRETE */}
                {activeTab === 'membrete' && (
                  <div className="space-y-5 animate-fadeIn">
                    <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-lg text-xs text-yellow-800 mb-4"><span className="font-bold">Nota:</span> Datos para el cajetín oficial.</div>
                    <div><label className="block text-xs font-semibold text-slate-600 mb-1">Nombre del Proyecto</label><input type="text" value={data.membrete.proyecto} onChange={(e) => handleMembreteChange('proyecto', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Plano</label><input type="text" value={data.membrete.plano} onChange={(e) => handleMembreteChange('plano', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm" /></div>
                      <div><label className="block text-xs font-semibold text-slate-600 mb-1">Nº Lámina</label><input type="text" value={data.membrete.lamina} onChange={(e) => handleMembreteChange('lamina', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-center font-mono" /></div>
                    </div>
                    <div><label className="block text-xs font-semibold text-slate-600 mb-1">Profesional Responsable</label><input type="text" value={data.membrete.profesional} onChange={(e) => handleMembreteChange('profesional', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs font-semibold text-slate-600 mb-1">Registro (CIP/CAP)</label><input type="text" value={data.membrete.registro} onChange={(e) => handleMembreteChange('registro', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm" /></div>
                      <div><label className="block text-xs font-semibold text-slate-600 mb-1">Fecha</label><input type="date" value={data.membrete.fecha} onChange={(e) => handleMembreteChange('fecha', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm" /></div>
                    </div>
                    <div><label className="block text-xs font-semibold text-slate-600 mb-1">Escala</label><select value={data.membrete.escala} onChange={(e) => handleMembreteChange('escala', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm"><option value="1/50">1/50</option><option value="1/100">1/100</option><option value="1/200">1/200</option><option value="1/500">1/500</option><option value="1/1000">1/1000</option><option value="Indicada">Indicada</option></select></div>
                  </div>
                )}

                {/* 3. CONTEXTO */}
                {activeTab === 'contexto' && (
                  <div className="space-y-5 animate-fadeIn">
                    <div className="space-y-3">
                      <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Modo de Ubicación</span>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'vectorial', label: 'Vectorial', icon: Layers, desc: 'Editor SVG' },
                          { id: 'satelital', label: 'Satelital', icon: Globe, desc: 'Mapa OSM' },
                          { id: 'imagen', label: 'Imagen', icon: Upload, desc: 'Estático' },
                        ].map((modo) => (
                          <button
                            key={modo.id}
                            onClick={() => setModoUbicacion(modo.id as any)}
                            className={`p-3 rounded-xl border text-left transition-all duration-200 ${data.config.modoUbicacion === modo.id
                              ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                          >
                            <modo.icon size={18} className={data.config.modoUbicacion === modo.id ? 'text-indigo-600 mb-2' : 'text-slate-400 mb-2'} />
                            <div className={`text-xs font-bold ${data.config.modoUbicacion === modo.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                              {modo.label}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* === MODO SATELITAL: BUSCADOR OSM === */}
                    {data.config.modoUbicacion === 'satelital' && (
                      <div className="space-y-3">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                          <label className="block text-xs font-bold text-blue-800 uppercase tracking-wide">
                            📍 Buscador de Ubicación OSM
                          </label>
                          <div className="flex gap-2">
                            <input
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSearchOSM()}
                              placeholder="Ej: Av. Arequipa, Lima"
                              className="flex-1 text-sm p-2 rounded border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              onClick={handleSearchOSM}
                              disabled={isSearching}
                              className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 flex items-center justify-center min-w-[40px] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isSearching ? <Loader2 className="animate-spin" size={16}/> : <Search size={16}/>}
                            </button>
                          </div>
                          <p className="text-[10px] text-blue-600">
                            Búsqueda gratuita powered by Nominatim / OpenStreetMap.
                          </p>
                          <div className="text-xs text-slate-600 bg-white p-2 rounded border border-blue-100">
                            💡 El buscador trasladará tu lote y vecinos a la ubicación encontrada.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* === MODO VECTORIAL: LISTA DE VECINOS === */}
                    {data.config.modoUbicacion === 'vectorial' && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lotes Vecinos</h3>
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{data.contexto.vecinos.length}</span>
                        </div>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {data.contexto.vecinos.map((vecino, idx) => (
                            <div
                              key={idx}
                              onClick={() => setSelectedNeighbor(vecino)}
                              className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:border-blue-300 transition-colors cursor-pointer group"
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-blue-500"></div>
                                  {vecino.nombre}
                                </span>
                                <code className="text-[10px] text-slate-400 bg-slate-50 px-1 rounded">{vecino.id}</code>
                              </div>
                            </div>
                          ))}

                          <button
                            onClick={() => setShowNeighborsImportModal(true)}
                            className="w-full py-2.5 text-xs font-medium border border-dashed border-slate-300 text-slate-500 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition-colors flex justify-center items-center gap-1.5"
                          >
                            <Upload size={14} /> Importar datos
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. VÉRTICES */}
                {activeTab === 'vertices' && (
                  <div className="animate-fadeIn h-full flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Coordenadas UTM (WGS84)</h3>
                      <div className="flex gap-2">
                        <button onClick={() => setShowImportModal(true)} className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded hover:bg-blue-100 transition-colors">
                          <Upload size={14} /> Importar
                        </button>
                        <button onClick={addVertex} className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded hover:bg-emerald-100 transition-colors"><Plus size={14} /> Añadir</button>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      {data.vertices.map((vertice, index) => (
                        <div key={index} className={`flex gap-2 items-center p-2 rounded border transition-colors ${hoveredVertexId === vertice.id ? 'bg-orange-50 border-orange-300 ring-1 ring-orange-200' : 'bg-slate-50 border-slate-200'}`} onMouseEnter={() => setHoveredVertexId(vertice.id)} onMouseLeave={() => setHoveredVertexId(null)}>
                          <input
                            type="text"
                            value={vertice.id}
                            onChange={(e) => handleVertexChange(index, 'id', e.target.value)}
                            className={`w-8 h-6 flex items-center justify-center bg-white rounded border text-[10px] font-bold shrink-0 shadow-sm outline-none text-center transition-all ${hoveredVertexId === vertice.id ? 'text-orange-600 border-orange-400 ring-1 ring-orange-100' : 'text-slate-600 border-slate-200 focus:border-blue-500'}`}
                          />
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <div className="relative"><span className="absolute left-1.5 top-1 text-[9px] font-bold text-slate-400">E</span><input type="number" value={vertice.x} onChange={(e) => handleVertexChange(index, 'x', e.target.value)} className="w-full pl-4 pr-1 py-1 text-xs bg-white border border-slate-200 rounded focus:border-blue-800 focus:outline-none" /></div>
                            <div className="relative"><span className="absolute left-1.5 top-1 text-[9px] font-bold text-slate-400">N</span><input type="number" value={vertice.y} onChange={(e) => handleVertexChange(index, 'y', e.target.value)} className="w-full pl-4 pr-1 py-1 text-xs bg-white border border-slate-200 rounded focus:border-blue-800 focus:outline-none" /></div>
                          </div>
                          <button onClick={() => removeVertex(index)} className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors" disabled={data.vertices.length <= 3}><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>








          {/* PANEL DERECHO: PLANO */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white p-1 rounded-xl shadow-md border border-slate-200 h-full flex flex-col">

              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-lg">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Maximize size={20} className="text-slate-700" /> Distribución Libre</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-slate-500">Vista: Perimétrico + Ubicación</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${data.config.modoUbicacion === 'satelital' ? 'bg-indigo-100 text-indigo-700' :
                      data.config.modoUbicacion === 'imagen' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-200 text-slate-600'
                      }`}>
                      {data.config.modoUbicacion === 'satelital' ? 'MODO SATÉLITE (OSM)' : 'MODO VECTOR (SVG)'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm items-center">
                  <MousePointer2 size={12} className="text-slate-400" />
                  <span>Arrastra los vértices para editar</span>
                </div>
              </div>

              <div className="flex-1 relative bg-white overflow-hidden flex items-center justify-center min-h-[600px] overflow-x-auto select-none bg-slate-100 p-4">

                {showPDFViewer ? (
                  <div className="w-full h-full min-h-[600px]">
                    <PDFViewerWrapper
                      loteId={data.loteId}
                      propietario={data.propietario}
                      area={data.dimensiones.area}
                      vertices={data.vertices}
                    />
                  </div>
                ) : data.config.modoUbicacion === 'satelital' && previewData ? (
                  // --- VISTA MAPA LEAFLET ---
                  <div className="w-full h-full relative rounded border border-slate-300 overflow-hidden z-0">
                    <MapContainer
                      center={previewData.leaflet.center as any}
                      zoom={18}
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <MapUpdaterComponent center={previewData.leaflet.center as any} />
                      <Polygon positions={previewData.leaflet.polygon as any} pathOptions={{ color: 'red', fillColor: 'orange', fillOpacity: 0.2 }} />
                      {typeof window !== 'undefined' && <Marker position={previewData.leaflet.center as any} icon={getCustomIcon()} />}
                    </MapContainer>
                    <div className="absolute top-2 right-2 bg-white/90 p-2 rounded shadow text-xs z-[1000]">
                       Fuente: OpenStreetMap
                    </div>
                  </div>
                ) : previewData ? (
                  // --- VISTA VECTORIAL SVG ---
                  <svg
                    ref={svgRef}
                    width="100%"
                    height="100%"
                    viewBox={`0 0 ${previewData.layout.width} ${previewData.layout.height}`}
                    className={`z-10 shadow-xl bg-white ${draggingVertexIndex !== null ? 'cursor-grabbing' : 'cursor-default'}`}
                    preserveAspectRatio="xMidYMid meet"
                    onMouseMove={handleSvgMouseMove}
                    onMouseUp={() => setDraggingVertexIndex(null)}
                    onMouseLeave={() => setDraggingVertexIndex(null)}
                  >
                    <defs>
                      <pattern id="diagonalHatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                        <line x1="0" y1="0" x2="0" y2="10" style={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
                      </pattern>
                      <pattern id="locationHatch" width="4" height="4" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                        <line x1="0" y1="0" x2="0" y2="4" style={{ stroke: '#64748b', strokeWidth: 1 }} />
                      </pattern>
                    </defs>

                    {/* PLANO PERIMÉTRICO */}
                    <g>
                      {/* Grilla */}
                      <g style={{ pointerEvents: 'none' }}>
                        {previewData.gridLines.map((line, i) => (
                          <g key={`grid-${i}`}>
                            <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="#f1f5f9" strokeWidth="1" strokeDasharray={line.type === 'v' ? "5,5" : "0"} />
                            {line.type === 'v' && <text x={line.x1} y={previewData.layout.rect2.y + previewData.layout.rect2.h - 5} fontSize="8" fill="#94a3b8" textAnchor="middle">{line.label}</text>}
                            {line.type === 'h' && <text x={previewData.layout.rect2.x + 5} y={line.y1 + 3} fontSize="8" fill="#94a3b8">{line.label}</text>}
                          </g>
                        ))}
                      </g>

                      {/* VECINOS EN PERIMÉTRICO */}
                      {data.config.modoUbicacion === 'vectorial' && previewData.neighborsPolygons.map((poly, i) => (
                        <polygon key={`vecino-main-${i}`} points={poly} fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" style={{ pointerEvents: 'none' }} />
                      ))}

                      <g transform={`translate(${previewData.layout.rect2.x + previewData.layout.rect2.w - 40}, ${previewData.layout.rect2.y + 40})`} style={{ pointerEvents: 'none' }}>
                        <line x1="0" y1="0" x2="0" y2="-25" stroke="#0f172a" strokeWidth="2" />
                        <polygon points="0,-25 -4,-15 4,-15" fill="#0f172a" />
                        <text x="0" y="-30" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a">N</text>
                      </g>

                      <polygon points={previewData.polygonPoints} fill="url(#diagonalHatch)" stroke="#000000" strokeWidth="2.5" strokeLinejoin="round" className="drop-shadow-sm" style={{ pointerEvents: 'none' }} />

                      {/* Centroide Label */}
                      <g transform={`translate(${previewData.centerLabel.x}, ${previewData.centerLabel.y})`} style={{ pointerEvents: 'none' }}>
                        <rect x="-50" y="-12" width="100" height="24" fill="white" stroke="#000" strokeWidth="0.5" rx="4" fillOpacity="0.9" />
                        <text x="0" y="-2" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#000">ÁREA: {data.dimensiones.area} m²</text>
                        <text x="0" y="8" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#000">PERÍM: {previewData.centerLabel.perimeter} ml</text>
                      </g>

                      {/* Cotas */}
                      {previewData.technicalData.map((dataPoint, i) => {
                        const isHovered = hoveredVertexId === dataPoint.vertex || draggingVertexIndex === i;
                        return (
                          <g key={`data-${i}`}>
                            <path d={dataPoint.arcPath} fill="rgba(0,0,0,0.05)" stroke="#000000" strokeWidth="0.5" style={{ pointerEvents: 'none' }} />
                            <text x={dataPoint.screen.labelX} y={dataPoint.screen.labelY} textAnchor="middle" alignmentBaseline="middle" fontSize="8" fill="#000" style={{ pointerEvents: 'none' }}>{dataPoint.angle}°</text>
                            <g style={{ pointerEvents: 'none' }}>
                              <rect x={dataPoint.screen.midX - 18} y={dataPoint.screen.midY - 7} width="36" height="14" fill="white" stroke="#e2e8f0" strokeWidth="0.5" rx="2" />
                              <text x={dataPoint.screen.midX} y={dataPoint.screen.midY + 3} textAnchor="middle" fontSize="9" fill="#000" fontWeight="bold">{dataPoint.dist}m</text>
                            </g>
                            <g className="cursor-grab active:cursor-grabbing" onMouseEnter={() => setHoveredVertexId(dataPoint.vertex)} onMouseLeave={() => setHoveredVertexId(null)} onMouseDown={(e) => { e.stopPropagation(); setDraggingVertexIndex(i); }}>
                              <circle cx={dataPoint.screen.x} cy={dataPoint.screen.y} r="20" fill="transparent" />
                              {isHovered && <circle cx={dataPoint.screen.x} cy={dataPoint.screen.y} r="10" fill="rgba(255, 165, 0, 0.3)" />}
                              <circle cx={dataPoint.screen.x} cy={dataPoint.screen.y} r="3.5" fill="white" stroke={isHovered ? "#ea580c" : "#000"} strokeWidth={isHovered ? 2 : 1} />
                              <text x={dataPoint.screen.x + 6} y={dataPoint.screen.y - 6} fill={isHovered ? "#ea580c" : "#000"} fontSize={isHovered ? "14" : "11"} fontWeight="bold" fontFamily="serif" style={{ pointerEvents: 'none' }}>{dataPoint.vertex}</text>
                            </g>
                          </g>
                        );
                      })}
                    </g>

                    {/* COLUMNA DERECHA */}

                    {/* Ubicación (Mini Mapa) */}
                    <g transform={`translate(${previewData.elements.locMap.x}, ${previewData.elements.locMap.y})`} style={{ pointerEvents: 'none' }}>
                      <text x={previewData.elements.locMap.w / 2} y="-8" textAnchor="middle" fontSize="9" fontWeight="bold">PLANO DE UBICACIÓN</text>
                      <rect x="0" y="0" width={previewData.elements.locMap.w} height={previewData.elements.locMap.h} fill="white" stroke="#000" strokeWidth="1" />
                      
                      <defs>
                        <clipPath id="locMapClip">
                          <rect x="0" y="0" width={previewData.elements.locMap.w} height={previewData.elements.locMap.h} />
                        </clipPath>
                      </defs>
                      <g clipPath="url(#locMapClip)">
                        <rect x={previewData.elements.locMap.block.x} y={previewData.elements.locMap.block.y} width={previewData.elements.locMap.block.w} height={previewData.elements.locMap.block.h} fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,2" />
                        <polygon points={previewData.elements.locMap.polyPoints} fill="url(#locationHatch)" stroke="#000" strokeWidth="1.5" />
                      </g>
                      <text x={previewData.elements.locMap.w - 15} y="20" fontSize="10" fontWeight="bold">N</text>
                      <line x1={previewData.elements.locMap.w - 11} y1="22" x2={previewData.elements.locMap.w - 11} y2="12" stroke="#000" strokeWidth="1" />
                      <polygon points={`${previewData.elements.locMap.w - 11},12 ${previewData.elements.locMap.w - 13},15 ${previewData.elements.locMap.w - 9},15`} fill="#000" />
                    </g>

                    {/* Tabla */}
                    <g transform={`translate(${previewData.elements.table.x}, ${previewData.elements.table.y})`} style={{ pointerEvents: 'none' }}>
                      <rect x="0" y="0" width={previewData.elements.table.w} height="20" fill="#000000" />
                      <text x={previewData.elements.table.w / 2} y="14" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">CUADRO DE DATOS TÉCNICOS</text>
                      <g transform="translate(0, 20)">
                        <rect x="0" y="0" width={previewData.elements.table.w} height="15" fill="#f1f5f9" stroke="#000" strokeWidth="0.5" />
                        {[0.12, 0.25, 0.40, 0.55, 0.77].map((p, k) => (
                          <line key={k} x1={previewData.elements.table.w * p} y1="0" x2={previewData.elements.table.w * p} y2="15" stroke="#000" strokeWidth="0.5" />
                        ))}
                        <text x={previewData.elements.table.w * 0.06} y="11" textAnchor="middle" fontSize="7" fontWeight="bold">V</text>
                        <text x={previewData.elements.table.w * 0.185} y="11" textAnchor="middle" fontSize="7" fontWeight="bold">LADO</text>
                        <text x={previewData.elements.table.w * 0.325} y="11" textAnchor="middle" fontSize="7" fontWeight="bold">DIST</text>
                        <text x={previewData.elements.table.w * 0.475} y="11" textAnchor="middle" fontSize="7" fontWeight="bold">ANG</text>
                        <text x={previewData.elements.table.w * 0.66} y="11" textAnchor="middle" fontSize="7" fontWeight="bold">ESTE (X)</text>
                        <text x={previewData.elements.table.w * 0.885} y="11" textAnchor="middle" fontSize="7" fontWeight="bold">NORTE (Y)</text>
                      </g>
                      {previewData.technicalData.map((row, i) => (
                        <g key={`table-row-${i}`} transform={`translate(0, ${35 + (i * 15)})`}>
                          <rect x="0" y="0" width={previewData.elements.table.w} height="15" fill={i % 2 === 0 ? "white" : "#f8fafc"} stroke="#000" strokeWidth="0.5" />
                          {[0.12, 0.25, 0.40, 0.55, 0.77].map((p, k) => (
                            <line key={k} x1={previewData.elements.table.w * p} y1="0" x2={previewData.elements.table.w * p} y2="15" stroke="#000" strokeWidth="0.5" />
                          ))}
                          <text x={previewData.elements.table.w * 0.06} y="11" textAnchor="middle" fontSize="8" fontWeight="bold">{row.vertex}</text>
                          <text x={previewData.elements.table.w * 0.185} y="11" textAnchor="middle" fontSize="8">{row.side}</text>
                          <text x={previewData.elements.table.w * 0.325} y="11" textAnchor="middle" fontSize="8">{row.dist}</text>
                          <text x={previewData.elements.table.w * 0.475} y="11" textAnchor="middle" fontSize="8">{row.angle}°</text>
                          <text x={previewData.elements.table.w * 0.66} y="11" textAnchor="middle" fontSize="8">{row.raw.x}</text>
                          <text x={previewData.elements.table.w * 0.885} y="11" textAnchor="middle" fontSize="8">{row.raw.y}</text>
                        </g>
                      ))}
                    </g>

                    {/* Membrete */}
                    <g transform={`translate(${previewData.elements.membrete.x}, ${previewData.elements.membrete.y})`} style={{ pointerEvents: 'none' }}>
                      <rect x="0" y="0" width={previewData.elements.membrete.w} height={previewData.elements.membrete.h} fill="white" stroke="#000" strokeWidth="2" />
                      <line x1={previewData.elements.membrete.w * 0.65} y1="0" x2={previewData.elements.membrete.w * 0.65} y2={previewData.elements.membrete.h} stroke="#000" strokeWidth="1" />
                      <line x1="0" y1="25" x2={previewData.elements.membrete.w * 0.65} y2="25" stroke="#000" strokeWidth="1" />
                      <line x1="0" y1="50" x2={previewData.elements.membrete.w * 0.65} y2="50" stroke="#000" strokeWidth="1" />
                      <line x1="0" y1="75" x2={previewData.elements.membrete.w * 0.65} y2="75" stroke="#000" strokeWidth="1" />
                      <text x="5" y="10" fontSize="7" fill="#666">PROYECTO:</text>
                      <text x="5" y="20" fontSize="8" fill="#000" fontWeight="bold">{data.membrete.proyecto.substring(0, 35)}</text>
                      <text x="5" y="35" fontSize="7" fill="#666">PLANO:</text>
                      <text x="5" y="45" fontSize="8" fill="#000" fontWeight="bold">{data.membrete.plano}</text>
                      <text x="5" y="60" fontSize="7" fill="#666">PROFESIONAL:</text>
                      <text x="50" y="60" fontSize="7" fill="#000">{data.membrete.profesional}</text>
                      <text x="5" y="85" fontSize="7" fill="#666">FECHA:</text>
                      <text x="35" y="85" fontSize="7" fill="#000">{data.membrete.fecha}</text>
                      <text x="90" y="85" fontSize="7" fill="#666">ESC:</text>
                      <text x="110" y="85" fontSize="7" fill="#000">{data.membrete.escala}</text>
                      <text x={previewData.elements.membrete.w * 0.825} y="30" fontSize="10" fill="#666" textAnchor="middle">LÁMINA</text>
                      <text x={previewData.elements.membrete.w * 0.825} y="70" fontSize="32" fill="#000" fontWeight="bold" textAnchor="middle">{data.membrete.lamina}</text>
                    </g>
                  </svg>
                ) : (
                  <div className="text-slate-400 flex flex-col items-center justify-center h-full gap-2">
                    <AlertCircle size={48} className="mb-2 opacity-20 text-red-500" />
                    <span className="font-bold text-slate-500">Error de Geometría</span>
                    <span className="text-xs text-slate-400">Verifique que las coordenadas formen un polígono válido.</span>
                  </div>
                )}
              </div>

              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-xs text-slate-500">
                <div className="flex gap-4"><span>WGS84 / Zona 18S</span></div>
                <div className="flex items-center gap-1 text-slate-900 font-bold">Área: {data.dimensiones.area} m²</div>
              </div>
            </div>
          </div>















        </main>

      </div>
      <ImportDataModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportVertices}
      />
      <ImportDataModal
        isOpen={showNeighborsImportModal}
        onClose={() => setShowNeighborsImportModal(false)}
        onImport={handleImportNeighbors}
        title="Importar Lote Vecino"
        subtitle="Carga coordenadas UTM para agregar un nuevo colindante"
      />
      <NeighborEditModal
        isOpen={!!selectedNeighbor}
        onClose={() => setSelectedNeighbor(null)}
        neighbor={selectedNeighbor}
        onSave={handleSaveNeighbor}
        onDelete={handleDeleteNeighbor}
      />
      <Toaster position="top-right" />
    </ProtectedRoute>
  );
}