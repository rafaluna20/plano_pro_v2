"use client";

/**
 * PanelContexto.tsx
 * Panel de modo de ubicación, buscador OSM y lista de lotes vecinos.
 */

import React from "react";
import { Layers, Globe, Upload, Search, Loader2 } from "lucide-react";
import type { LoteData, LoteVecino } from "@/app/hooks/useLoteData";

interface PanelContextoProps {
  data: LoteData;
  onModoChange: (modo: "vectorial" | "satelital" | "imagen") => void;
  onNeighborClick: (v: LoteVecino) => void;
  onOpenImportNeighbors: () => void;
  // OSM search
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  isSearching: boolean;
  onSearch: () => void;
  onSearchKeyDown: (e: React.KeyboardEvent) => void;
}

const modos = [
  { id: "vectorial", label: "Vectorial", icon: Layers, desc: "Editor SVG" },
  { id: "satelital", label: "Satelital", icon: Globe,  desc: "Mapa OSM" },
  { id: "imagen",    label: "Imagen",    icon: Upload,  desc: "Estático"  },
] as const;

export function PanelContexto({
  data,
  onModoChange,
  onNeighborClick,
  onOpenImportNeighbors,
  searchQuery,
  onSearchQueryChange,
  isSearching,
  onSearch,
  onSearchKeyDown,
}: PanelContextoProps) {
  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Modo de Ubicación */}
      <div className="space-y-3">
        <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
          Modo de Ubicación
        </span>
        <div className="grid grid-cols-3 gap-2">
          {modos.map((modo) => (
            <button
              key={modo.id}
              onClick={() => onModoChange(modo.id)}
              className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                data.config.modoUbicacion === modo.id
                  ? "bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <modo.icon
                size={18}
                className={
                  data.config.modoUbicacion === modo.id
                    ? "text-indigo-600 mb-2"
                    : "text-slate-400 mb-2"
                }
              />
              <div
                className={`text-xs font-bold ${
                  data.config.modoUbicacion === modo.id
                    ? "text-indigo-900"
                    : "text-slate-700"
                }`}
              >
                {modo.label}
              </div>
              <div className="text-[10px] text-slate-400">{modo.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Buscador OSM (solo en modo satelital) */}
      {data.config.modoUbicacion === "satelital" && (
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
          <label className="block text-xs font-bold text-blue-800 uppercase tracking-wide">
            📍 Buscador de Ubicación
          </label>
          <div className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Ej: Av. Arequipa, Lima"
              className="flex-1 text-sm p-2 rounded border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <button
              onClick={onSearch}
              disabled={isSearching}
              className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 flex items-center justify-center min-w-[40px] disabled:opacity-50"
            >
              {isSearching ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Search size={16} />
              )}
            </button>
          </div>
          <p className="text-[10px] text-blue-600">
            Powered by Nominatim / OpenStreetMap (gratuito).
          </p>
          <div className="text-xs text-slate-600 bg-white p-2 rounded border border-blue-100">
            💡 El buscador trasladará tu lote y vecinos a la ubicación encontrada.
          </div>
        </div>
      )}

      {/* Lista de Vecinos (solo en modo vectorial) */}
      {data.config.modoUbicacion === "vectorial" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Lotes Vecinos
            </h3>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
              {data.contexto.vecinos.length}
            </span>
          </div>

          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {data.contexto.vecinos.map((vecino, idx) => (
              <div
                key={idx}
                onClick={() => onNeighborClick(vecino)}
                className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:border-blue-300 transition-colors cursor-pointer group"
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-blue-500 transition-colors" />
                    {vecino.nombre}
                  </span>
                  <code className="text-[10px] text-slate-400 bg-slate-50 px-1 rounded">
                    {vecino.id}
                  </code>
                </div>
                {vecino.vertices.length > 0 && (
                  <p className="text-[10px] text-slate-400 mt-1 ml-4">
                    {vecino.vertices.length} vértices
                  </p>
                )}
              </div>
            ))}

            <button
              onClick={onOpenImportNeighbors}
              className="w-full py-2.5 text-xs font-medium border border-dashed border-slate-300 text-slate-500 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition-colors flex justify-center items-center gap-1.5"
            >
              <Upload size={14} /> Importar lote vecino
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
