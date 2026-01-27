'use client';

import { useState } from 'react';

interface PreviewPaneProps {
  pdfUrl?: string;
  pdfBase64?: string;
  status: 'idle' | 'generating' | 'completed' | 'error';
  error?: string;
  onRegenerate?: () => void;
  onDownload?: () => void;
}

export function PreviewPane({
  pdfUrl,
  pdfBase64,
  status,
  error,
  onRegenerate,
  onDownload
}: PreviewPaneProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const getPdfSrc = () => {
    if (pdfUrl) return pdfUrl;
    if (pdfBase64) return `data:application/pdf;base64,${pdfBase64}`;
    return null;
  };

  const pdfSrc = getPdfSrc();

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b">
        <h3 className="font-semibold text-gray-900">Vista Previa</h3>
        
        {status === 'completed' && pdfSrc && (
          <div className="flex gap-2">
            <button
              onClick={onRegenerate}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition"
            >
              ↻ Regenerar
            </button>
            <button
              onClick={onDownload}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition"
            >
              ⬇ Descargar
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {status === 'idle' && (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-2 text-sm">Genera un plano para ver la vista previa</p>
            </div>
          </div>
        )}

        {status === 'generating' && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-sm text-gray-600">Generando plano...</p>
              <p className="mt-1 text-xs text-gray-500">Esto puede tomar unos segundos</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-2">Error al generar plano</p>
              <p className="text-xs text-gray-600 mb-4">{error || 'Ocurrió un error desconocido'}</p>
              <button
                onClick={onRegenerate}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition"
              >
                Intentar nuevamente
              </button>
            </div>
          </div>
        )}

        {status === 'completed' && pdfSrc && (
          <div className="h-full bg-white rounded-lg shadow-sm overflow-hidden">
            <iframe
              src={pdfSrc}
              className="w-full h-full border-0"
              title="Vista previa del plano"
            />
          </div>
        )}
      </div>

      {/* Footer con info */}
      {status === 'completed' && (
        <div className="px-4 py-2 bg-white border-t text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <span>Plano generado exitosamente</span>
            <span>{new Date().toLocaleString('es-PE')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
