"use client";

/**
 * usePDFExport.ts
 * Hook para la exportación de PDF con progreso visual por etapas.
 */

import { useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { buildHybridPayload } from "@/app/utils/payloadBuilder";
import type { LoteData } from "./useLoteData";

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type ExportStep =
  | "idle"
  | "validating"
  | "building"
  | "sending"
  | "generating"
  | "downloading"
  | "done"
  | "error";

export interface ExportState {
  step: ExportStep;
  progress: number; // 0-100
  message: string;
  timeMs?: number;
}

const STEP_CONFIG: Record<ExportStep, { progress: number; message: string }> = {
  idle:        { progress: 0,   message: "" },
  validating:  { progress: 10,  message: "Validando datos del lote..." },
  building:    { progress: 25,  message: "Construyendo estructura del plano..." },
  sending:     { progress: 45,  message: "Enviando al servidor..." },
  generating:  { progress: 70,  message: "Generando PDF técnico..." },
  downloading: { progress: 90,  message: "Preparando descarga..." },
  done:        { progress: 100, message: "¡PDF generado exitosamente!" },
  error:       { progress: 0,   message: "Error durante la generación" },
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function usePDFExport() {
  const [exportState, setExportState] = useState<ExportState>({
    step: "idle",
    progress: 0,
    message: "",
  });

  const setStep = useCallback((step: ExportStep, extra?: Partial<ExportState>) => {
    const config = STEP_CONFIG[step];
    setExportState({ step, ...config, ...extra });
  }, []);

  const isLoading = exportState.step !== "idle" &&
    exportState.step !== "done" &&
    exportState.step !== "error";

  const handleGeneratePDF = useCallback(
    async (data: LoteData) => {
      // ── 1. Validación ────────────────────────────────────────────────────
      setStep("validating");

      if (data.vertices.length < 3) {
        toast.error("Se requieren al menos 3 vértices para generar el PDF");
        setStep("error");
        setTimeout(() => setStep("idle"), 2000);
        return;
      }

      const startTime = Date.now();

      try {
        // ── 2. Construir payload ─────────────────────────────────────────
        setStep("building");
        const hybridPayload = buildHybridPayload(data as any);

        // ── 3. Enviar al servidor ────────────────────────────────────────
        setStep("sending");

        const response = await fetch("/api/v1/planos/generar-hibrido", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(hybridPayload),
        });

        // ── 4. Generando PDF ─────────────────────────────────────────────
        setStep("generating");

        if (!response.ok) {
          if (response.status === 400) {
            const errorData = await response.json();
            toast.error(errorData.error?.message || "Error de validación");
          } else if (response.status === 401) {
            toast.error("Sesión expirada. Por favor inicia sesión nuevamente.");
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          setStep("error");
          setTimeout(() => setStep("idle"), 3000);
          return;
        }

        // Leer headers informativos
        const dataSourceArea = response.headers.get("X-Data-Source-Area");
        const requiresReview = response.headers.get("X-Requires-Review");
        const genTime = response.headers.get("X-Generation-Time");

        // ── 5. Descargar ─────────────────────────────────────────────────
        setStep("downloading");
        const pdfBlob = await response.blob();

        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `plano_${data.loteId}_${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        // ── 6. Éxito ─────────────────────────────────────────────────────
        const totalTime = Date.now() - startTime;
        setStep("done", { timeMs: totalTime });

        toast.success("¡PDF generado y descargado!");

        if (dataSourceArea === "CALCULADO") {
          toast("📐 Área calculada automáticamente desde la geometría", {
            icon: "ℹ️",
            duration: 3000,
          });
        }

        if (requiresReview === "true") {
          toast("⚠️ El plano requiere revisión manual por discrepancias", {
            icon: "⚠️",
            duration: 5000,
          });
        }

        if (genTime) {
          toast(`⏱️ Generado en ${genTime}ms`, { duration: 2000 });
        }

        // Volver a idle después de 3 segundos
        setTimeout(() => setStep("idle"), 3000);
      } catch (error) {
        console.error("❌ Error al generar PDF:", error);
        toast.error("Error al conectar con el servidor. Intenta nuevamente.");
        setStep("error");
        setTimeout(() => setStep("idle"), 3000);
      }
    },
    [setStep]
  );

  const resetExport = useCallback(() => setStep("idle"), [setStep]);

  return {
    exportState,
    isLoading,
    handleGeneratePDF,
    resetExport,
  };
}
