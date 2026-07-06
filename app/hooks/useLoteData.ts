"use client";

/**
 * useLoteData.ts
 * Hook centralizado para el estado del formulario de catastro.
 * Separa toda la lógica de datos de la UI.
 */

import { useState, useEffect, useCallback } from "react";
import {
  calculatePolygonArea,
  calcularCentroide,
} from "@/app/utils/geometry";

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface Vertice {
  id: string;
  x: number;
  y: number;
}

export interface LoteVecino {
  id: string;
  nombre: string;
  vertices: Vertice[];
  codigo?: string;
  estado?: string;
}

export interface MembreteData {
  proyecto: string;
  plano: string;
  profesional: string;
  registro: string;
  fecha: string;
  lamina: string;
  escala: string;
}

export interface UbicacionData {
  direccion: string;
  distrito: string;
  provincia: string;
  departamento: string;
}

export type Lado = "norte" | "sur" | "este" | "oeste";

export interface LoteAdyacente {
  id: string;
  estado: string;
  dimension: number;
  lote: string;
  propietario: string;
  vertices: Vertice[];
}

export interface LoteData {
  loteId: string;
  propietario: string;
  area: number;
  membrete: MembreteData;
  vertices: Vertice[];
  contexto: { vecinos: LoteVecino[] };
  config: { modoUbicacion: "vectorial" | "satelital" | "imagen" };
  imagenGeneral: string;
  logoUrl: string;
  lotesAdyacentes: Partial<Record<Lado, LoteAdyacente>>;
  ubicacion: UbicacionData;
}

// ─── Estado inicial ───────────────────────────────────────────────────────────
const INITIAL_DATA: LoteData = {
  loteId: "MZ-C-Lote14",
  propietario: "Inversiones Santa Rosa S.A.C.",
  area: 0,
  membrete: {
    proyecto: "Habilitación Urbana Los Cedros",
    plano: "Perimétrico y Ubicación",
    profesional: "Ing. Juan Pérez",
    registro: "CIP 123456",
    fecha: new Date().toISOString().split("T")[0],
    lamina: "P-01",
    escala: "1/500",
  },
  ubicacion: {
    direccion: "",
    distrito: "Lima",
    provincia: "Lima",
    departamento: "Lima",
  },
  vertices: [
    { id: "A", x: 284500.0, y: 8670100.0 },
    { id: "B", x: 284510.0, y: 8670100.0 },
    { id: "C", x: 284510.0, y: 8670080.0 },
    { id: "D", x: 284500.0, y: 8670080.0 },
  ],
  imagenGeneral:
    "https://ik.imagekit.io/m5f5k3axy/video_presentation.jpg?updatedAt=1741844704040",
  logoUrl:
    "https://ik.imagekit.io/m5f5k3axy/LOGO_LAYA.png?updatedAt=1762278469920",
  contexto: {
    vecinos: [
      {
        id: "V1",
        nombre: "Lote 13 (Izq)",
        codigo: "MZ-C-Lote13",
        estado: "libre",
        vertices: [
          { id: "1", x: 284490.0, y: 8670100.0 },
          { id: "2", x: 284500.0, y: 8670100.0 },
          { id: "3", x: 284500.0, y: 8670080.0 },
          { id: "4", x: 284490.0, y: 8670080.0 },
        ],
      },
      {
        id: "V2",
        nombre: "Lote 15 (Der)",
        codigo: "MZ-C-Lote15",
        estado: "libre",
        vertices: [
          { id: "1", x: 284510.0, y: 8670100.0 },
          { id: "2", x: 284520.0, y: 8670100.0 },
          { id: "3", x: 284520.0, y: 8670080.0 },
          { id: "4", x: 284510.0, y: 8670080.0 },
        ],
      },
    ],
  },
  config: { modoUbicacion: "vectorial" },
  lotesAdyacentes: {
    norte: {
      id: "ltn1", dimension: 0, estado: "libre", lote: "Lote 01",
      propietario: "Inversiones Santa Rosa S.A.C.",
      vertices: [
        { id: "A", x: 284500.0, y: 8670120.0 }, { id: "B", x: 284510.0, y: 8670120.0 },
        { id: "C", x: 284510.0, y: 8670100.0 }, { id: "D", x: 284500.0, y: 8670100.0 },
      ],
    },
    sur: {
      id: "ltn2", dimension: 0, estado: "libre", lote: "Lote 03",
      propietario: "Inversiones Santa Rosa S.A.C.",
      vertices: [
        { id: "A", x: 284500.0, y: 8670080.0 }, { id: "B", x: 284510.0, y: 8670080.0 },
        { id: "C", x: 284510.0, y: 8670060.0 }, { id: "D", x: 284500.0, y: 8670060.0 },
      ],
    },
    este: {
      id: "ltn3", dimension: 0, estado: "libre", lote: "Lote 02",
      propietario: "Inversiones Santa Rosa S.A.C.",
      vertices: [
        { id: "A", x: 284510.0, y: 8670100.0 }, { id: "B", x: 284520.0, y: 8670100.0 },
        { id: "C", x: 284520.0, y: 8670080.0 }, { id: "D", x: 284510.0, y: 8670080.0 },
      ],
    },
    oeste: {
      id: "ltn4", dimension: 0, estado: "libre", lote: "Lote 04",
      propietario: "Inversiones Santa Rosa S.A.C.",
      vertices: [
        { id: "A", x: 284490.0, y: 8670100.0 }, { id: "B", x: 284500.0, y: 8670100.0 },
        { id: "C", x: 284500.0, y: 8670080.0 }, { id: "D", x: 284490.0, y: 8670080.0 },
      ],
    },
  },
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useLoteData() {
  const [data, setData] = useState<LoteData>(INITIAL_DATA);

  // Auto-cálculo de área cuando cambian los vértices
  useEffect(() => {
    const newArea = calculatePolygonArea(data.vertices);
    if (Math.abs(newArea - data.area) > 0.01 && data.vertices.length >= 3) {
      setData((prev) => ({ ...prev, area: newArea }));
    }
  }, [data.vertices]);

  const handleRootChange = useCallback((field: keyof LoteData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleMembreteChange = useCallback(
    (field: keyof MembreteData, value: string) => {
      setData((prev) => ({ ...prev, membrete: { ...prev.membrete, [field]: value } }));
    },
    []
  );

  const handleUbicacionChange = useCallback(
    (field: keyof UbicacionData, value: string) => {
      setData((prev) => ({ ...prev, ubicacion: { ...prev.ubicacion, [field]: value } }));
    },
    []
  );

  const handleColindanciaChange = useCallback(
    (section: "dimension" | "lote", lado: Lado, value: string | number) => {
      setData((prev) => ({
        ...prev,
        lotesAdyacentes: {
          ...prev.lotesAdyacentes,
          [lado]: { ...prev.lotesAdyacentes[lado], [section]: value },
        },
      }));
    },
    []
  );

  // Sincroniza vértices compartidos con lotes adyacentes
  const syncAdyacentes = useCallback(
    (
      prevLotesAdyacentes: LoteData["lotesAdyacentes"],
      oldCoords: { x: number; y: number },
      newX: number,
      newY: number
    ) => {
      const epsilon = 0.1;
      const updated = { ...prevLotesAdyacentes };
      Object.keys(updated).forEach((key) => {
        const side = key as Lado;
        const info = updated[side];
        if (info?.vertices) {
          updated[side] = {
            ...info,
            vertices: info.vertices.map((v) => {
              const dx = Math.abs(v.x - oldCoords.x);
              const dy = Math.abs(v.y - oldCoords.y);
              return dx < epsilon && dy < epsilon
                ? { ...v, x: newX, y: newY }
                : v;
            }),
          };
        }
      });
      return updated;
    },
    []
  );

  const handleVertexChange = useCallback(
    (index: number, field: keyof Vertice, value: string) => {
      const newVal = field === "id" ? value : parseFloat(value) || 0;
      setData((prev) => {
        const oldCoords = { ...prev.vertices[index] };
        const newVertices = prev.vertices.map((v, i) =>
          i === index ? { ...v, [field]: newVal } : v
        );
        let newLotesAdyacentes = prev.lotesAdyacentes;
        if (field === "x" || field === "y") {
          const newX = field === "x" ? (newVal as number) : oldCoords.x;
          const newY = field === "y" ? (newVal as number) : oldCoords.y;
          newLotesAdyacentes = syncAdyacentes(prev.lotesAdyacentes, oldCoords, newX, newY);
        }
        return {
          ...prev,
          vertices: newVertices,
          lotesAdyacentes: newLotesAdyacentes,
          area: calculatePolygonArea(newVertices),
        };
      });
    },
    [syncAdyacentes]
  );

  const handleSvgDrag = useCallback(
    (index: number, newX: number, newY: number) => {
      setData((prev) => {
        const oldCoords = { ...prev.vertices[index] };
        const newVertices = prev.vertices.map((v, i) =>
          i === index ? { ...v, x: Number(newX.toFixed(2)), y: Number(newY.toFixed(2)) } : v
        );
        const newLotesAdyacentes = syncAdyacentes(prev.lotesAdyacentes, oldCoords, newX, newY);
        return {
          ...prev,
          vertices: newVertices,
          lotesAdyacentes: newLotesAdyacentes,
          area: calculatePolygonArea(newVertices),
        };
      });
    },
    [syncAdyacentes]
  );

  const addVertex = useCallback(() => {
    setData((prev) => {
      const lastV = prev.vertices[prev.vertices.length - 1];
      const newId = String.fromCharCode(lastV.id.charCodeAt(0) + 1);
      return {
        ...prev,
        vertices: [...prev.vertices, { id: newId, x: lastV.x + 5, y: lastV.y }],
      };
    });
  }, []);

  const removeVertex = useCallback((index: number) => {
    setData((prev) => {
      if (prev.vertices.length <= 3) return prev;
      return { ...prev, vertices: prev.vertices.filter((_, i) => i !== index) };
    });
  }, []);

  const setModoUbicacion = useCallback(
    (modo: "vectorial" | "satelital" | "imagen") => {
      setData((prev) => ({ ...prev, config: { ...prev.config, modoUbicacion: modo } }));
    },
    []
  );

  const handleImportVertices = useCallback((newCoords: [number, number][]) => {
    const newVertices: Vertice[] = newCoords.map((coord, index) => ({
      id:
        String.fromCharCode(65 + (index % 26)) +
        (index >= 26 ? Math.floor(index / 26) : ""),
      x: coord[0],
      y: coord[1],
    }));
    setData((prev) => ({ ...prev, vertices: newVertices }));
  }, []);

  const handleImportNeighbors = useCallback((newCoords: [number, number][]) => {
    setData((prev) => {
      const nextIdx = prev.contexto.vecinos.length + 1;
      const newNeighbor: LoteVecino = {
        id: `V${nextIdx}`,
        nombre: `Lote Vecino ${nextIdx}`,
        codigo: `MZ-AUTO-${nextIdx}`,
        estado: "libre",
        vertices: newCoords.map((coord, index) => ({
          id: (index + 1).toString(),
          x: coord[0],
          y: coord[1],
        })),
      };
      return {
        ...prev,
        contexto: { vecinos: [...prev.contexto.vecinos, newNeighbor] },
      };
    });
  }, []);

  const handleSaveNeighbor = useCallback((updatedNeighbor: LoteVecino) => {
    setData((prev) => ({
      ...prev,
      contexto: {
        vecinos: prev.contexto.vecinos.map((v) =>
          v.id === updatedNeighbor.id ? updatedNeighbor : v
        ),
      },
    }));
  }, []);

  const handleDeleteNeighbor = useCallback((neighborId: string) => {
    setData((prev) => ({
      ...prev,
      contexto: {
        vecinos: prev.contexto.vecinos.filter((v) => v.id !== neighborId),
      },
    }));
  }, []);

  const trasladarTodo = useCallback(
    (newUtmX: number, newUtmY: number) => {
      setData((prev) => {
        const centroid = calcularCentroide(prev.vertices);
        const deltaX = newUtmX - centroid.x;
        const deltaY = newUtmY - centroid.y;

        const trasladar = (verts: Vertice[]) =>
          verts.map((v) => ({
            ...v,
            x: parseFloat((v.x + deltaX).toFixed(2)),
            y: parseFloat((v.y + deltaY).toFixed(2)),
          }));

        const newLotesAdyacentes = { ...prev.lotesAdyacentes };
        (Object.keys(newLotesAdyacentes) as Lado[]).forEach((lado) => {
          const info = newLotesAdyacentes[lado];
          if (info) {
            newLotesAdyacentes[lado] = { ...info, vertices: trasladar(info.vertices) };
          }
        });

        return {
          ...prev,
          vertices: trasladar(prev.vertices),
          contexto: {
            vecinos: prev.contexto.vecinos.map((v) => ({
              ...v,
              vertices: trasladar(v.vertices),
            })),
          },
          lotesAdyacentes: newLotesAdyacentes,
        };
      });
    },
    []
  );

  return {
    data,
    setData,
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
  };
}
