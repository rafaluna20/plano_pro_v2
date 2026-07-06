"use client";

/**
 * PanelGeneral.tsx
 * Panel de datos generales del lote: ID, propietario, área, colindancias y ubicación.
 */

import React from "react";
import { RefreshCw } from "lucide-react";
import type { LoteData, Lado, UbicacionData } from "@/app/hooks/useLoteData";

interface PanelGeneralProps {
  data: LoteData;
  onRootChange: (field: keyof LoteData, value: string) => void;
  onColindanciaChange: (section: "dimension" | "lote", lado: Lado, value: string | number) => void;
  onUbicacionChange: (field: keyof UbicacionData, value: string) => void;
}

const inputCls =
  "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-800 transition";

const labelCls = "block text-xs font-semibold text-slate-600 mb-1";

export function PanelGeneral({
  data,
  onRootChange,
  onColindanciaChange,
  onUbicacionChange,
}: PanelGeneralProps) {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── Identificación ──────────────────────────────────────────── */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Identificación
        </h3>

        <div>
          <label className={labelCls}>Código Lote</label>
          <input
            type="text"
            value={data.loteId}
            onChange={(e) => onRootChange("loteId", e.target.value)}
            className={inputCls}
            placeholder="Ej: MZ-C-Lote14"
          />
        </div>

        <div>
          <label className={labelCls}>Propietario</label>
          <input
            type="text"
            value={data.propietario}
            onChange={(e) => onRootChange("propietario", e.target.value)}
            className={inputCls}
            placeholder="Nombre del propietario"
          />
        </div>

        <div>
          <label className={labelCls}>Área Calculada (m²)</label>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={data.area}
              readOnly
              className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-md text-sm text-slate-500 cursor-not-allowed"
            />
            <span title="Calculado automáticamente desde los vértices">
              <RefreshCw size={16} className="text-slate-400" />
            </span>
          </div>
        </div>
      </div>

      {/* ── Ubicación Geográfica ─────────────────────────────────────── */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Ubicación Geográfica
        </h3>

        <div>
          <label className={labelCls}>Dirección / Vía</label>
          <input
            type="text"
            value={data.ubicacion.direccion}
            onChange={(e) => onUbicacionChange("direccion", e.target.value)}
            className={inputCls}
            placeholder="Ej: Av. Los Cedros 145"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Distrito</label>
            <input
              type="text"
              value={data.ubicacion.distrito}
              onChange={(e) => onUbicacionChange("distrito", e.target.value)}
              className={inputCls}
              placeholder="Lima"
            />
          </div>
          <div>
            <label className={labelCls}>Provincia</label>
            <input
              type="text"
              value={data.ubicacion.provincia}
              onChange={(e) => onUbicacionChange("provincia", e.target.value)}
              className={inputCls}
              placeholder="Lima"
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Departamento</label>
          <input
            type="text"
            value={data.ubicacion.departamento}
            onChange={(e) => onUbicacionChange("departamento", e.target.value)}
            className={inputCls}
            placeholder="Lima"
          />
        </div>
      </div>

      {/* ── Colindancias ────────────────────────────────────────────── */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Colindancias
        </h3>
        {(["norte", "sur", "este", "oeste"] as Lado[]).map((lado) => (
          <div key={lado} className="space-y-1">
            <label className="block text-xs font-semibold text-blue-800 capitalize">
              {lado}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1 relative">
                <input
                  type="number"
                  value={data.lotesAdyacentes[lado]?.dimension ?? ""}
                  onChange={(e) =>
                    onColindanciaChange("dimension", lado, parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-2 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md pr-5"
                  placeholder="0.00"
                />
                <span className="absolute right-2 top-2 text-xs text-slate-400">m</span>
              </div>
              <div className="col-span-2">
                <input
                  type="text"
                  placeholder="Nombre del colindante..."
                  value={data.lotesAdyacentes[lado]?.lote ?? ""}
                  onChange={(e) => onColindanciaChange("lote", lado, e.target.value)}
                  className="w-full px-2 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
