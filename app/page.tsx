"use client";

import React, { useState, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { Toaster } from "react-hot-toast";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PDFViewerWrapper } from "@/components/planos/PDFViewerWrapper";
import { ImportDataModal } from "@/components/planos/ImportDataModal";
import { NeighborEditModal } from "@/components/planos/NeighborEditModal";

import { useLoteData } from "@/app/hooks/useLoteData";
import { usePDFExport } from "@/app/hooks/usePDFExport";
import { useMapLocation } from "@/app/hooks/useMapLocation";
import { calculatePerimeter, describeArc, polarToCartesian } from "@/app/utils/geometry";

import { EditorHeader } from "@/components/editor/EditorHeader";
import { PanelGeneral } from "@/components/editor/panels/PanelGeneral";
import { PanelMembrete } from "@/components/editor/panels/PanelMembrete";
import { PanelContexto } from "@/components/editor/panels/PanelContexto";
import { PanelVertices } from "@/components/editor/panels/PanelVertices";

const LocationMap = dynamic(() => import("@/components/editor/LocationMap"), { ssr: false });
const SateliteMap = dynamic(() => import("@/components/editor/SateliteMap"), { ssr: false });

export default function LoteEditor() {
  const {
    data,
    handleRootChange,
    handleMembreteChange,
    handleUbicacionChange,
    handleColindanciaChange,
    handleVertexChange,
    handleSvgDrag,
    addVertex,
    removeVertex,
    setModoUbicacion,
    handleImportVertices,
    handleImportNeighbors,
    handleSaveNeighbor,
    handleDeleteNeighbor,
    trasladarTodo,
  } = useLoteData();

  const { exportState, isLoading, handleGeneratePDF } = usePDFExport();
  const mapLocation = useMapLocation(trasladarTodo);

  // Estados de UI locales
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [hoveredVertexId, setHoveredVertexId] = useState<string | null>(null);
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);
  
  // Estado para las pestañas del panel izquierdo
  const [activeTab, setActiveTab] = useState<"general" | "contexto" | "membrete">("general");

  // Estado para la imagen general
  const [zoom, setZoom] = useState(1);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [imageDragStart, setImageDragStart] = useState({ x: 0, y: 0 });

  // Modales
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTarget, setImportTarget] = useState<"vertices" | "vecino">("vertices");
  const [neighborModalData, setNeighborModalData] = useState<any | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  // Lógica pesada de generación SVG extraída como useMemo
  const previewData = useMemo(() => {
    try {
      const vertices = data.vertices;
      if (vertices.length < 3) return null;

      const width = 800;
      const height = 500;
      const margin = 50;

      const rect2 = { x: margin, y: margin, w: width - margin * 2 - 250, h: height - margin * 2 };
      const rect3 = { x: rect2.x + rect2.w + 10, y: margin, w: 240, h: height - margin * 2 };

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      vertices.forEach((v) => {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
      });

      let deltaX = maxX - minX;
      let deltaY = maxY - minY;
      if (deltaX === 0) deltaX = 1;
      if (deltaY === 0) deltaY = 1;

      const scaleX = (rect2.w - 80) / deltaX;
      const scaleY = (rect2.h - 80) / deltaY;
      const scale = Math.min(scaleX, scaleY) * zoom;

      const centerX = rect2.x + rect2.w / 2;
      const centerY = rect2.y + rect2.h / 2;

      const toScreen = (x: number, y: number) => ({
        x: centerX + (x - (minX + maxX) / 2) * scale,
        y: centerY - (y - (minY + maxY) / 2) * scale,
      });

      const screenToWorld = (sx: number, sy: number) => ({
        x: (sx - centerX) / scale + (minX + maxX) / 2,
        y: (centerY - sy) / scale + (minY + maxY) / 2,
      });

      const points = vertices.map((v) => ({ ...toScreen(v.x, v.y), label: v.id, rawX: v.x, rawY: v.y }));
      const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

      const gridLines = [];
      const gridStep = 5; // simplified
      for (let x = Math.floor(minX / gridStep) * gridStep; x <= Math.ceil(maxX / gridStep) * gridStep; x += gridStep) {
        const p1 = toScreen(x, minY);
        const p2 = toScreen(x, maxY);
        gridLines.push({ type: "v", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, label: x.toFixed(0) });
      }
      for (let y = Math.floor(minY / gridStep) * gridStep; y <= Math.ceil(maxY / gridStep) * gridStep; y += gridStep) {
        const p1 = toScreen(minX, y);
        const p2 = toScreen(maxX, y);
        gridLines.push({ type: "h", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, label: y.toFixed(0) });
      }

      let totalPerimeter = 0;
      let areaSum = 0;
      for (let i = 0; i < vertices.length; i++) {
        const j = (i + 1) % vertices.length;
        areaSum += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
      }
      const isClockwise = areaSum < 0;

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
          startArc = normNext + 90;
          endArc = normPrev + 90;
        } else {
          let diff = normNext - normPrev;
          if (diff < 0) diff += 360;
          angleInternal = diff;
          startArc = normPrev + 90;
          endArc = normNext + 90;
        }

        const arcPath = describeArc(p.x, p.y, 20, startArc, endArc);
        let bisectorAngle = startArc + angleInternal / 2;
        if (endArc < startArc) bisectorAngle = startArc + (360 - startArc + endArc) / 2;
        const labelPos = polarToCartesian(p.x, p.y, 32, bisectorAngle);

        return {
          vertex: p.label,
          side: `${p.label}-${points[nextIndex].label}`,
          dist: dist.toFixed(2),
          angle: angleInternal.toFixed(2),
          arcPath,
          screen: { x: p.x, y: p.y, midX: (p.x + nextP.x) / 2, midY: (p.y + nextP.y) / 2, labelX: labelPos.x, labelY: labelPos.y },
          raw: { x: rawP.x.toFixed(2), y: rawP.y.toFixed(2) },
        };
      });

      const adyacentes = Object.entries(data.lotesAdyacentes || {}).map(([key, info]) => {
        if (!info || !info.vertices) return null;
        const pts = info.vertices.map((v) => toScreen(v.x, v.y));
        const poly = pts.map((p) => `${p.x},${p.y}`).join(" ");
        let cx = 0, cy = 0;
        pts.forEach((p) => { cx += p.x; cy += p.y; });
        return { id: key, lote: info.lote, poly, labelPos: { x: cx / pts.length, y: cy / pts.length } };
      }).filter((item): item is NonNullable<typeof item> => item !== null);

      return {
        layout: { width, height, rect2, rect3 },
        points, polygonPoints, gridLines, technicalData, adyacentes,
        centerLabel: { x: centerX, y: centerY, perimeter: totalPerimeter.toFixed(2) },
        screenToWorld
      };
    } catch (e) {
      console.error("Error calculando geometría:", e);
      return null;
    }
  }, [data.vertices, data.lotesAdyacentes, zoom]);

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingVertexIndex !== null && svgRef.current && previewData) {
      const rect = svgRef.current.getBoundingClientRect();
      const coords = previewData.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      handleSvgDrag(draggingVertexIndex, coords.x, coords.y);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 p-6 font-sans">
        <Toaster />
        
        <EditorHeader
          showPDFViewer={showPDFViewer}
          onTogglePDFViewer={() => setShowPDFViewer(!showPDFViewer)}
          onExportPDF={() => handleGeneratePDF(data)}
          exportState={exportState}
          isLoading={isLoading}
        />

        <div className="max-w-[1400px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6 h-[calc(100vh-140px)] min-h-[600px]">
          {/* Panel Izquierdo: Formulario con Pestañas */}
          <div className="xl:col-span-4 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            <div className="border-b border-slate-100 bg-slate-50/50">
              <div className="px-6 py-4">
                <h2 className="text-lg font-bold text-slate-800">Propiedades</h2>
                <p className="text-xs text-slate-500">Configuración del Lote</p>
              </div>
              
              {/* Navegación por pestañas */}
              <div className="flex border-t border-slate-100">
                <button
                  onClick={() => setActiveTab("general")}
                  className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-colors ${
                    activeTab === "general"
                      ? "border-blue-600 text-blue-700 bg-blue-50/50"
                      : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  }`}
                >
                  General
                </button>
                <button
                  onClick={() => setActiveTab("contexto")}
                  className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-colors ${
                    activeTab === "contexto"
                      ? "border-blue-600 text-blue-700 bg-blue-50/50"
                      : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  }`}
                >
                  Contexto
                </button>
                <button
                  onClick={() => setActiveTab("membrete")}
                  className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-colors ${
                    activeTab === "membrete"
                      ? "border-blue-600 text-blue-700 bg-blue-50/50"
                      : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  }`}
                >
                  Membrete
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {activeTab === "general" && (
                <PanelGeneral
                  data={data}
                  onRootChange={handleRootChange}
                  onColindanciaChange={handleColindanciaChange}
                  onUbicacionChange={handleUbicacionChange}
                />
              )}
              
              {activeTab === "contexto" && (
                <PanelContexto
                  data={data}
                  onModoChange={setModoUbicacion}
                  onNeighborClick={(v) => setNeighborModalData(v)}
                  onOpenImportNeighbors={() => {
                    setImportTarget("vecino");
                    setIsImportModalOpen(true);
                  }}
                  searchQuery={mapLocation.searchQuery}
                  onSearchQueryChange={mapLocation.setSearchQuery}
                  isSearching={mapLocation.isSearching}
                  onSearch={mapLocation.handleSearchOSM}
                  onSearchKeyDown={mapLocation.handleKeyDown}
                />
              )}
              
              {activeTab === "membrete" && (
                <PanelMembrete
                  data={data}
                  onMembreteChange={handleMembreteChange}
                  onLogoChange={(url) => handleRootChange("logoUrl", url)}
                />
              )}
            </div>
          </div>

          {/* Panel Central/Derecho: Visualización */}
          <div className="xl:col-span-8 flex flex-col gap-6 h-full">
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col min-h-0 relative">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-800">Previsualización</h2>
              </div>

              <div className="flex-1 border border-slate-200 rounded-lg bg-slate-50 relative overflow-hidden">
                {showPDFViewer ? (
                  <PDFViewerWrapper
                    loteId={data.loteId}
                    propietario={data.propietario}
                    area={data.area}
                    vertices={data.vertices}
                    modoUbicacion={data.config.modoUbicacion}
                    imagenGeneral={data.imagenGeneral}
                    logoUrl={data.logoUrl}
                  />
                ) : data.config.modoUbicacion === "imagen" ? (
                  <div className="w-full h-full flex flex-col relative overflow-hidden bg-white">
                    <div
                      className="w-full h-full flex items-center justify-center cursor-move"
                      style={{
                        width: `${Math.max(10, 100 * zoom)}%`,
                        height: `${Math.max(10, 100 * zoom)}%`,
                        transform: `translate(${imageOffset.x}px, ${imageOffset.y}px)`,
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsDraggingImage(true);
                        setImageDragStart({ x: e.clientX - imageOffset.x, y: e.clientY - imageOffset.y });
                      }}
                      onMouseMove={(e) => {
                        if (isDraggingImage) setImageOffset({ x: e.clientX - imageDragStart.x, y: e.clientY - imageDragStart.y });
                      }}
                      onMouseUp={() => setIsDraggingImage(false)}
                      onMouseLeave={() => setIsDraggingImage(false)}
                    >
                      <img src={data.imagenGeneral} alt="Plano General" className="max-w-full max-h-full object-contain pointer-events-none" />
                    </div>
                    <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-[1000]">
                      <button onClick={() => setZoom((z) => Math.min(5, z + 0.1))} className="bg-white p-2 rounded shadow"><ZoomIn size={20} /></button>
                      <button onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))} className="bg-white p-2 rounded shadow"><ZoomOut size={20} /></button>
                      <button onClick={() => { setZoom(1); setImageOffset({ x: 0, y: 0 }); }} className="bg-white p-2 rounded shadow"><Maximize size={20} /></button>
                    </div>
                  </div>
                ) : data.config.modoUbicacion === "satelital" ? (
                  <SateliteMap
                    vertices={data.vertices}
                    vecinos={data.contexto.vecinos}
                    lotesAdyacentes={data.lotesAdyacentes}
                  />
                ) : previewData ? (
                  <svg
                    ref={svgRef}
                    width="100%"
                    height="100%"
                    viewBox={`0 0 ${previewData.layout.width} ${previewData.layout.height}`}
                    className={`z-10 bg-white ${draggingVertexIndex !== null ? "cursor-grabbing" : "cursor-default"}`}
                    preserveAspectRatio="xMidYMid meet"
                    onMouseMove={handleSvgMouseMove}
                    onMouseUp={() => setDraggingVertexIndex(null)}
                    onMouseLeave={() => setDraggingVertexIndex(null)}
                  >
                    <defs>
                      <pattern id="diagonalHatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                        <line x1="0" y1="0" x2="0" y2="10" style={{ stroke: "#e2e8f0", strokeWidth: 1 }} />
                      </pattern>
                    </defs>
                    
                    <g>
                      <g style={{ pointerEvents: "none" }}>
                        {previewData.gridLines.map((line, i) => (
                          <g key={`grid-${i}`}>
                            <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="#f1f5f9" strokeDasharray={line.type === "v" ? "5,5" : "0"} />
                          </g>
                        ))}
                      </g>
                      
                      {previewData.adyacentes.map((ady, idx) => (
                        <g key={`ady-${idx}`} style={{ pointerEvents: "none" }}>
                          <polygon points={ady.poly} fill="#f8fafc" stroke="#cbd5e1" strokeDasharray="4,2" />
                          <text x={ady.labelPos.x} y={ady.labelPos.y} textAnchor="middle" fontSize="7" fill="#94a3b8">{ady.lote}</text>
                        </g>
                      ))}

                      <polygon points={previewData.polygonPoints} fill="url(#diagonalHatch)" stroke="#000" strokeWidth="2.5" style={{ pointerEvents: "none" }} />

                      {previewData.technicalData.map((dataPoint, i) => {
                        const isHovered = hoveredVertexId === dataPoint.vertex || draggingVertexIndex === i;
                        return (
                          <g key={`data-${i}`}>
                            <path d={dataPoint.arcPath} fill="rgba(0,0,0,0.05)" stroke="#000" strokeWidth="0.5" />
                            <g className="cursor-grab active:cursor-grabbing"
                               onMouseEnter={() => setHoveredVertexId(dataPoint.vertex)}
                               onMouseLeave={() => setHoveredVertexId(null)}
                               onMouseDown={(e) => { e.stopPropagation(); setDraggingVertexIndex(i); }}>
                              <circle cx={dataPoint.screen.x} cy={dataPoint.screen.y} r="20" fill="transparent" />
                              <circle cx={dataPoint.screen.x} cy={dataPoint.screen.y} r="3.5" fill="white" stroke={isHovered ? "#ea580c" : "#000"} strokeWidth={isHovered ? 2 : 1} />
                              <text x={dataPoint.screen.x + 6} y={dataPoint.screen.y - 6} fill={isHovered ? "#ea580c" : "#000"} fontSize="11" fontWeight="bold" style={{ pointerEvents: "none" }}>{dataPoint.vertex}</text>
                            </g>
                          </g>
                        );
                      })}
                    </g>
                    
                    <g transform={`translate(${previewData.layout.rect3.x}, ${previewData.layout.rect3.y})`}>
                      <rect width="200" height="150" fill="white" stroke="#000" />
                      <foreignObject x="0.5" y="0.5" width="199" height="149">
                        <LocationMap vertices={data.vertices} adyacentes={[]} interactive={false} />
                      </foreignObject>
                    </g>
                  </svg>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
                    <AlertCircle size={48} className="text-red-500 opacity-20" />
                    <span>Error de Geometría</span>
                  </div>
                )}
              </div>
            </div>

            <div className="h-64 bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col min-h-0">
              <PanelVertices
                vertices={data.vertices}
                hoveredVertexId={hoveredVertexId}
                onHoverVertex={setHoveredVertexId}
                onVertexChange={handleVertexChange}
                onAddVertex={addVertex}
                onRemoveVertex={removeVertex}
                onOpenImport={() => {
                  setImportTarget("vertices");
                  setIsImportModalOpen(true);
                }}
              />
            </div>
          </div>
        </div>

        {/* Modales */}
        <ImportDataModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={(coords) => {
            if (importTarget === "vertices") handleImportVertices(coords);
            else handleImportNeighbors(coords);
            setIsImportModalOpen(false);
          }}
          title={importTarget === "vertices" ? "Importar Vértices del Lote" : "Importar Lote Vecino"}
          subtitle={
            importTarget === "vertices"
              ? "Carga las coordenadas del lote principal (CSV, GeoJSON, KML o TXT)"
              : "Carga las coordenadas de un lote colindante (CSV, GeoJSON, KML o TXT)"
          }
        />

        <NeighborEditModal
          isOpen={!!neighborModalData}
          onClose={() => setNeighborModalData(null)}
          neighbor={neighborModalData || {}}
          onSave={(n) => {
            handleSaveNeighbor(n);
            setNeighborModalData(null);
          }}
          onDelete={(id) => {
            handleDeleteNeighbor(id);
            setNeighborModalData(null);
          }}
        />

        {/* Modal de Mapa Fullscreen */}
        {isMapFullscreen && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 backdrop-blur-sm">
            <div className="bg-white w-full h-full rounded-2xl flex flex-col overflow-hidden relative">
              <button
                onClick={() => setIsMapFullscreen(false)}
                className="absolute top-4 right-4 z-50 bg-white/90 p-2 rounded-full shadow hover:bg-slate-100"
              >
                ✕
              </button>
              <div className="flex-1 relative">
                <LocationMap vertices={data.vertices} adyacentes={[]} interactive={true} />
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
