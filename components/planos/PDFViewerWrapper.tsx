'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { PlanoDocument } from './pdf/PlanoDocument';

const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando visor PDF...</p>
        </div>
      </div>
    )
  }
);

interface PDFViewerWrapperProps {
  loteId: string;
  propietario: string;
  area: number;
  vertices: Array<{ id: string; x: number; y: number }>;
  modoUbicacion?: 'vectorial' | 'satelital' | 'imagen';
  imagenGeneral?: string;
  logoUrl?: string;
  adyacentes?: Array<{ id: string; lote: string; leafletPolygon: Array<[number, number]>; vertices: Array<{ id: string; x: number; y: number }> }>;
  contexto?: { vecinos: Array<{ id: string; nombre: string; vertices: Array<{ id: string; x: number; y: number }> }> };
  /**
   * Captura del mapa Leaflet (base64), tomada por el componente padre
   * mientras el <MapContainer> en vivo está montado. Este wrapper ya NO
   * hace su propia llamada a un servicio de mapas: solo renderiza lo que
   * se le pasa.
   */
  satelliteUrl?: string;
}

export function PDFViewerWrapper({
  loteId,
  propietario,
  area,
  vertices,
  modoUbicacion = 'vectorial',
  imagenGeneral,
  logoUrl,
  adyacentes,
  contexto,
  satelliteUrl
}: PDFViewerWrapperProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Inicializando PDF...</p>
        </div>
      </div>
    );
  }

  return (
    <PDFViewer width="100%" height="100%" className="border-0">
      <PlanoDocument
        loteId={loteId}
        propietario={propietario}
        vertices={vertices}
        modoUbicacion={modoUbicacion}
        imagenGeneral={imagenGeneral}
        satelliteUrl={satelliteUrl}
        logoUrl={logoUrl}
        lotesAdyacentes={adyacentes?.map(a => ({ id: a.lote, vertices: a.vertices }))}
        contexto={contexto}
      />
    </PDFViewer>
  );
}
