"use client";

/**
 * PanelVertices.tsx
 * Panel de gestión de coordenadas UTM con edición, drag y acciones.
 */

import React from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import type { Vertice } from "@/app/hooks/useLoteData";

interface PanelVerticesProps {
  vertices: Vertice[];
  hoveredVertexId: string | null;
  onHoverVertex: (id: string | null) => void;
  onVertexChange: (index: number, field: keyof Vertice, value: string) => void;
  onAddVertex: () => void;
  onRemoveVertex: (index: number) => void;
  onOpenImport: () => void;
}

export function PanelVertices({
  vertices,
  hoveredVertexId,
  onHoverVertex,
  onVertexChange,
  onAddVertex,
  onRemoveVertex,
  onOpenImport,
}: PanelVerticesProps) {
  return (
    <div className="animate-fadeIn h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Coordenadas UTM WGS84 / 18S
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onOpenImport}
            className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded hover:bg-blue-100 transition-colors"
          >
            <Upload size={13} /> Importar
          </button>
          <button
            onClick={onAddVertex}
            className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded hover:bg-emerald-100 transition-colors"
          >
            <Plus size={13} /> Añadir
          </button>
        </div>
      </div>

      {/* Lista de Vértices */}
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {vertices.map((vertice, index) => {
          const isHovered = hoveredVertexId === vertice.id;
          return (
            <div
              key={index}
              className={`flex gap-2 items-center p-2 rounded border transition-colors ${
                isHovered
                  ? "bg-orange-50 border-orange-300 ring-1 ring-orange-200"
                  : "bg-slate-50 border-slate-200 hover:border-slate-300"
              }`}
              onMouseEnter={() => onHoverVertex(vertice.id)}
              onMouseLeave={() => onHoverVertex(null)}
            >
              {/* ID del vértice */}
              <input
                type="text"
                value={vertice.id}
                onChange={(e) => onVertexChange(index, "id", e.target.value)}
                className={`w-8 h-6 text-center bg-white rounded border text-[10px] font-bold shrink-0 shadow-sm outline-none transition-all ${
                  isHovered
                    ? "text-orange-600 border-orange-400"
                    : "text-slate-600 border-slate-200 focus:border-blue-500"
                }`}
              />

              {/* Coordenadas Este / Norte */}
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div className="relative">
                  <span className="absolute left-1.5 top-1 text-[9px] font-bold text-slate-400 pointer-events-none">E</span>
                  <input
                    type="number"
                    value={vertice.x}
                    onChange={(e) => onVertexChange(index, "x", e.target.value)}
                    className="w-full pl-4 pr-1 py-1 text-xs bg-white border border-slate-200 rounded focus:border-blue-800 focus:outline-none"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-1.5 top-1 text-[9px] font-bold text-slate-400 pointer-events-none">N</span>
                  <input
                    type="number"
                    value={vertice.y}
                    onChange={(e) => onVertexChange(index, "y", e.target.value)}
                    className="w-full pl-4 pr-1 py-1 text-xs bg-white border border-slate-200 rounded focus:border-blue-800 focus:outline-none"
                  />
                </div>
              </div>

              {/* Eliminar */}
              <button
                onClick={() => onRemoveVertex(index)}
                disabled={vertices.length <= 3}
                className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title={vertices.length <= 3 ? "Mínimo 3 vértices" : "Eliminar vértice"}
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer: resumen */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
        <span>{vertices.length} vértices</span>
        <span>Sistema: WGS84 Zona 18S</span>
      </div>
    </div>
  );
}
