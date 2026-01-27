'use client';

import React from 'react';
import { MapPin, RefreshCw, Download, FileText, Maximize } from 'lucide-react';
import toast from 'react-hot-toast';

interface PlanoHeaderProps {
  onGeneratePDF: () => Promise<void>;
  onReset: () => void;
  loading: boolean;
  showPDFViewer: boolean;
  setShowPDFViewer: (show: boolean) => void;
}

export const PlanoHeader: React.FC<PlanoHeaderProps> = ({
  onGeneratePDF,
  onReset,
  loading,
  showPDFViewer,
  setShowPDFViewer
}) => {

  const handleReset = () => {
    if (confirm('¿Estás seguro de reiniciar todos los datos?')) {
      onReset();
      toast.success('Datos reiniciados correctamente');
    }
  };

  const handleGeneratePDF = async () => {
    try {
      await onGeneratePDF();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast.error(`Error al generar PDF: ${message}`);
    }
  };

  return (
    <header className="max-w-[1400px] mx-auto mb-6 flex flex-col md:flex-row justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-slate-200">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <MapPin className="text-blue-800" aria-hidden="true" />
          Editor de Catastro Urbano
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Generación de Planos Perimétricos y Memorias Descriptivas
        </p>
      </div>

      <div className="flex gap-3 mt-4 md:mt-0">
        <button
          onClick={handleReset}
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
          aria-label="Reiniciar todos los datos"
        >
          <RefreshCw size={16} aria-hidden="true" />
          Reiniciar
        </button>

        <button
          onClick={() => setShowPDFViewer(!showPDFViewer)}
          className={`px-4 py-2 text-sm font-medium text-white ${showPDFViewer
              ? 'bg-orange-600 hover:bg-orange-700'
              : 'bg-green-600 hover:bg-green-700'
            } rounded-lg shadow-md flex items-center gap-2 transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 ${showPDFViewer ? 'focus:ring-orange-500' : 'focus:ring-green-500'
            }`}
          aria-label={showPDFViewer ? 'Ver vista SVG' : 'Ver viewPDF'}
        >
          {showPDFViewer ? (
            <>
              <Maximize size={16} aria-hidden="true" />
              Vista SVG
            </>
          ) : (
            <>
              <FileText size={16} aria-hidden="true" />
              viewPDF
            </>
          )}
        </button>

        <button
          onClick={handleGeneratePDF}
          disabled={loading}
          className="px-6 py-2 text-sm font-medium text-white bg-blue-800 hover:bg-blue-900 rounded-lg shadow-md flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
          aria-label="Exportar plano a PDF"
          aria-busy={loading}
        >
          {loading ? (
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" aria-hidden="true" />
          ) : (
            <Download size={18} aria-hidden="true" />
          )}
          {loading ? 'Procesando...' : 'Exportar PDF'}
        </button>
      </div>
    </header>
  );
};
