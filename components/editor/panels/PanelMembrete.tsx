"use client";

/**
 * PanelMembrete.tsx
 * Panel de datos del cajetín oficial (membrete).
 */

import React from "react";
import type { LoteData, MembreteData } from "@/app/hooks/useLoteData";

interface PanelMembreteProps {
  data: LoteData;
  onMembreteChange: (field: keyof MembreteData, value: string) => void;
  onLogoChange: (url: string) => void;
}

const inputCls =
  "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-800";

const labelCls = "block text-xs font-semibold text-slate-600 mb-1";

export function PanelMembrete({ data, onMembreteChange, onLogoChange }: PanelMembreteProps) {
  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-lg text-xs text-yellow-800">
        <span className="font-bold">Nota:</span> Datos que aparecerán en el cajetín oficial del plano.
      </div>

      <div>
        <label className={labelCls}>Nombre del Proyecto</label>
        <input
          type="text"
          value={data.membrete.proyecto}
          onChange={(e) => onMembreteChange("proyecto", e.target.value)}
          className={inputCls}
          placeholder="Habilitación Urbana Los Cedros"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Tipo de Plano</label>
          <input
            type="text"
            value={data.membrete.plano}
            onChange={(e) => onMembreteChange("plano", e.target.value)}
            className={inputCls}
            placeholder="Perimétrico y Ubicación"
          />
        </div>
        <div>
          <label className={labelCls}>Nº Lámina</label>
          <input
            type="text"
            value={data.membrete.lamina}
            onChange={(e) => onMembreteChange("lamina", e.target.value)}
            className={`${inputCls} text-center font-mono`}
            placeholder="P-01"
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Profesional Responsable</label>
        <input
          type="text"
          value={data.membrete.profesional}
          onChange={(e) => onMembreteChange("profesional", e.target.value)}
          className={inputCls}
          placeholder="Ing. Juan Pérez"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Registro (CIP/CAP)</label>
          <input
            type="text"
            value={data.membrete.registro}
            onChange={(e) => onMembreteChange("registro", e.target.value)}
            className={inputCls}
            placeholder="CIP 123456"
          />
        </div>
        <div>
          <label className={labelCls}>Fecha</label>
          <input
            type="date"
            value={data.membrete.fecha}
            onChange={(e) => onMembreteChange("fecha", e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Escala</label>
        <select
          value={data.membrete.escala}
          onChange={(e) => onMembreteChange("escala", e.target.value)}
          className={inputCls}
        >
          <option value="1/50">1/50</option>
          <option value="1/100">1/100</option>
          <option value="1/200">1/200</option>
          <option value="1/500">1/500</option>
          <option value="1/1000">1/1000</option>
          <option value="Indicada">Indicada</option>
        </select>
      </div>

      <div>
        <label className={labelCls}>URL del Logo</label>
        <input
          type="text"
          placeholder="https://ejemplo.com/logo.png"
          value={data.logoUrl}
          onChange={(e) => onLogoChange(e.target.value)}
          className={inputCls}
        />
        {data.logoUrl && (
          <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-200 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.logoUrl}
              alt="Vista previa logo"
              className="max-h-12 object-contain"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
