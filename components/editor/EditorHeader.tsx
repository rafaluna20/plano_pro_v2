"use client";

/**
 * EditorHeader.tsx
 * Barra superior del editor con botones de navegación y exportación.
 * Incluye barra de progreso animada durante la exportación PDF.
 */

import React from "react";
import {
  MapPin, LayoutDashboard, PenTool, FileText, Maximize, Download,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ExportState } from "@/app/hooks/usePDFExport";

interface EditorHeaderProps {
  showPDFViewer: boolean;
  onTogglePDFViewer: () => void;
  onExportPDF: () => void;
  exportState: ExportState;
  isLoading: boolean;
}

export function EditorHeader({
  showPDFViewer,
  onTogglePDFViewer,
  onExportPDF,
  exportState,
  isLoading,
}: EditorHeaderProps) {
  const router = useRouter();

  return (
    <header className="max-w-[1400px] mx-auto mb-6 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Barra de progreso animada */}
      <div
        className={`h-1 transition-all duration-500 ${
          isLoading ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background:
            exportState.step === "done"
              ? "#10b981"
              : exportState.step === "error"
              ? "#ef4444"
              : "linear-gradient(90deg, #1e40af, #3b82f6, #06b6d4)",
          width: `${exportState.progress}%`,
          transition: "width 0.6s ease, opacity 0.3s",
        }}
      />

      <div className="px-5 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        {/* Título */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="text-blue-800" size={22} />
            Editor de Catastro Urbano
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Generación de Planos Perimétricos y Memorias Descriptivas
          </p>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-3 items-center flex-wrap justify-end">
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-2 transition-colors"
          >
            <LayoutDashboard size={16} />
            Dashboard
          </button>

          <button
            onClick={() => router.push("/editor")}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md flex items-center gap-2 transition-transform active:scale-95"
          >
            <PenTool size={16} />
            CAD Pro
          </button>

          <button
            onClick={onTogglePDFViewer}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-md flex items-center gap-2 transition-transform active:scale-95 ${
              showPDFViewer
                ? "bg-orange-500 hover:bg-orange-600"
                : "bg-teal-600 hover:bg-teal-700"
            }`}
          >
            {showPDFViewer ? (
              <>
                <Maximize size={16} /> Vista SVG
              </>
            ) : (
              <>
                <FileText size={16} /> Vista Previa
              </>
            )}
          </button>

          {/* Botón Exportar PDF con estado de progreso */}
          <button
            onClick={onExportPDF}
            disabled={isLoading}
            className={`px-6 py-2 text-sm font-semibold text-white rounded-lg shadow-md flex items-center gap-2 transition-all active:scale-95 disabled:cursor-not-allowed
              ${
                exportState.step === "done"
                  ? "bg-emerald-600"
                  : exportState.step === "error"
                  ? "bg-red-600"
                  : "bg-blue-800 hover:bg-blue-900"
              }
              ${isLoading ? "opacity-80" : ""}
            `}
          >
            {isLoading ? (
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : exportState.step === "done" ? (
              <span>✓</span>
            ) : exportState.step === "error" ? (
              <span>✕</span>
            ) : (
              <Download size={17} />
            )}
            <span className="min-w-[90px] text-left">
              {isLoading
                ? exportState.message.length > 22
                  ? exportState.message.substring(0, 22) + "…"
                  : exportState.message
                : exportState.step === "done"
                ? "¡Descargado!"
                : exportState.step === "error"
                ? "Reintentar"
                : "Exportar PDF"}
            </span>
          </button>
        </div>
      </div>

      {/* Barra de progreso con etiquetas (solo visible cuando se exporta) */}
      {isLoading && (
        <div className="px-5 pb-3 flex items-center gap-3">
          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-700 to-blue-400 transition-all duration-500"
              style={{ width: `${exportState.progress}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 shrink-0 min-w-[120px]">
            {exportState.message}
          </span>
        </div>
      )}
    </header>
  );
}
