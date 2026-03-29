'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { PlanoDocument } from './pdf/PlanoDocument';
import { MapService } from '@/lib/services/MapService';

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
  latLngs?: Array<[number, number]>;
  adyacentes?: Array<{ id: string; lote: string; leafletPolygon: Array<[number, number]>; vertices: Array<{ id: string; x: number; y: number }> }>;
  contexto?: { vecinos: Array<{ id: string; nombre: string; vertices: Array<{ id: string; x: number; y: number }> }> };
  onSatelliteLoaded?: (url: string) => void;
}

export function PDFViewerWrapper({
  loteId,
  propietario,
  area,
  vertices,
  modoUbicacion = 'vectorial',
  imagenGeneral,
  logoUrl,
  latLngs,
  adyacentes,
  contexto,
  onSatelliteLoaded
}: PDFViewerWrapperProps) {
  const [mounted, setMounted] = useState(false);
  const [satelliteUrl, setSatelliteUrl] = useState<string>('');
  const [loadingSatellite, setLoadingSatellite] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchSatellite() {
      if (modoUbicacion === 'satelital' && latLngs && latLngs.length > 0) {
        setLoadingSatellite(true);
        try {
          const adjPolys = adyacentes?.map(a => a.leafletPolygon);
          const url = await MapService.getStaticMapWithPolygon(latLngs, 250, 250, 17, 2, 'satellite', adjPolys);
          setSatelliteUrl(url);
          if (onSatelliteLoaded) {
            onSatelliteLoaded(url);
          }
        } catch (error) {
          console.error("Failed to fetch satellite image:", error);
        } finally {
          setLoadingSatellite(false);
        }
      }
    }
    fetchSatellite();
  }, [modoUbicacion, latLngs, adyacentes]);

  if (!mounted || loadingSatellite) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
             {!mounted ? 'Inicializando PDF...' : 'Cargando mapa satelital...'}
          </p>
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
