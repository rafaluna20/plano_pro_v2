'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { PlanoTopograficoPDF } from './PlanoPDFRenderer';

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
}

export function PDFViewerWrapper({ loteId, propietario, area, vertices }: PDFViewerWrapperProps) {
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
      <PlanoTopograficoPDF
        loteId={loteId}
        propietario={propietario}
        vertices={vertices}
      />
    </PDFViewer>
  );
}
