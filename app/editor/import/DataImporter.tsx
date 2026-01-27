'use client';

import { useState, useCallback, useRef } from 'react';
import { parseFileContent, validateUTMCoordinates } from '@/lib/editor/importers';
import { useWizardStore } from '@/lib/editor/wizardStore';
import { InputMethod } from '@/types/editor';
import { UTMCoordinate } from '@/types/planos';
import toast from 'react-hot-toast';
import { Upload, FileText, AlertCircle, CheckCircle, X, Copy } from 'lucide-react';

export function DataImporter() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importedData, setImportedData] = useState<{
    vertices: UTMCoordinate[];
    filename: string;
    warnings: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setMethod, setVertices } = useWizardStore();

  // Formatos soportados
  const supportedFormats = [
    { ext: '.csv', name: 'CSV', icon: '📄', desc: 'Coordenadas en formato CSV (x,y por línea)' },
    { ext: '.json', name: 'GeoJSON', icon: '🗺️', desc: 'Archivo GeoJSON con geometría' },
    { ext: '.geojson', name: 'GeoJSON', icon: '🗺️', desc: 'Archivo GeoJSON con geometría' },
    { ext: '.kml', name: 'KML', icon: '📍', desc: 'Archivo KML de Google Earth' },
    { ext: '.txt', name: 'Texto', icon: '📝', desc: 'Texto plano con coordenadas' },
  ];

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];
    await processFile(file);
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    await processFile(file);
  }, []);

  const processFile = async (file: File) => {
    setIsProcessing(true);
    
    try {
      const content = await file.text();
      const result = parseFileContent(file.name, content);

      if (!result.success) {
        toast.error(result.error || 'Error al procesar el archivo');
        setIsProcessing(false);
        return;
      }

      if (!result.vertices || result.vertices.length < 3) {
        toast.error('El archivo debe contener al menos 3 coordenadas');
        setIsProcessing(false);
        return;
      }

      // Validar coordenadas UTM
      const validation = validateUTMCoordinates(result.vertices);
      
      setImportedData({
        vertices: result.vertices,
        filename: file.name,
        warnings: validation.warnings,
      });

      if (validation.warnings.length > 0) {
        toast('Advertencias detectadas. Revisa las coordenadas.', {
          icon: '⚠️',
          duration: 4000,
        });
      } else {
        toast.success(`✅ ${result.vertices.length} coordenadas importadas exitosamente`);
      }
    } catch (error) {
      toast.error(`Error al leer el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUseData = () => {
    if (!importedData) return;

    setMethod(InputMethod.IMPORT);
    setVertices(importedData.vertices);
    toast.success('¡Datos cargados! Continuando al siguiente paso...');
  };

  const handleClear = () => {
    setImportedData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast('Datos descartados');
  };

  const handleCopyExample = (format: string) => {
    let example = '';
    
    switch (format) {
      case 'csv':
        example = `x,y
280000,8660000
280010,8660000
280010,8660020
280000,8660020`;
        break;
      case 'geojson':
        example = `{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [280000, 8660000],
      [280010, 8660000],
      [280010, 8660020],
      [280000, 8660020],
      [280000, 8660000]
    ]]
  }
}`;
        break;
      case 'txt':
        example = `280000 8660000
280010 8660000
280010 8660020
280000 8660020`;
        break;
    }
    
    navigator.clipboard.writeText(example);
    toast.success('Ejemplo copiado al portapapeles');
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Importar Datos de Coordenadas
        </h2>
        <p className="text-slate-600">
          Carga un archivo con coordenadas UTM para crear automáticamente el plano
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Upload Area */}
          {!importedData && (
            <>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-all ${
                  isDragging
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50'
                } ${isProcessing ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className={`w-16 h-16 mx-auto mb-4 ${
                  isDragging ? 'text-blue-600' : 'text-slate-400'
                }`} />
                
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {isProcessing ? 'Procesando archivo...' : 
                   isDragging ? 'Suelta el archivo aquí' : 
                   'Arrastra un archivo o haz click para seleccionar'}
                </h3>
                
                <p className="text-sm text-slate-600 mb-4">
                  Soporta: CSV, GeoJSON, KML, TXT
                </p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json,.geojson,.kml,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm"
                >
                  Seleccionar Archivo
                </button>
              </div>

              {/* Supported Formats */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Formatos Soportados
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {supportedFormats.map(format => (
                    <div
                      key={format.ext}
                      className="p-4 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{format.icon}</span>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {format.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {format.ext}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCopyExample(format.ext.slice(1))}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Copiar ejemplo"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-slate-600">
                        {format.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Help Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">
                      💡 Formato de Coordenadas UTM
                    </h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Las coordenadas deben estar en formato UTM Zone 18S (Perú)</li>
                      <li>• X (Este): típicamente entre 160,000 - 840,000</li>
                      <li>• Y (Norte): típicamente entre 8,000,000 - 9,000,000</li>
                      <li>• El sistema validará automáticamente las coordenadas</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Preview Imported Data */}
          {importedData && (
            <div className="space-y-4">
              {/* Success Card */}
              <div className="bg-white rounded-lg border border-green-200 p-6">
                <div className="flex items-start gap-3 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">
                      Datos Importados Exitosamente
                    </h3>
                    <p className="text-sm text-slate-600">
                      Archivo: <span className="font-medium">{importedData.filename}</span>
                    </p>
                  </div>
                  <button
                    onClick={handleClear}
                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Descartar datos"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Vértices</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {importedData.vertices.length}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Tipo</div>
                    <div className="text-sm font-semibold text-slate-900">
                      {importedData.vertices.length >= 3 ? 'Polígono' : 'Línea'}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Estado</div>
                    <div className="text-sm font-semibold text-green-600">
                      ✓ Válido
                    </div>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {importedData.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-amber-900 mb-2">
                        ⚠️ Advertencias Detectadas
                      </h4>
                      <ul className="text-sm text-amber-800 space-y-1">
                        {importedData.warnings.map((warning, i) => (
                          <li key={i}>• {warning}</li>
                        ))}
                      </ul>
                      <p className="text-xs text-amber-700 mt-2">
                        Las coordenadas pueden estar fuera del rango esperado para Perú (UTM Zone 18S).
                        Verifica que sean correctas antes de continuar.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Coordinates Preview */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">
                  Coordenadas Importadas (primeras 10)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2 text-left text-slate-600 font-medium">#</th>
                        <th className="px-4 py-2 text-left text-slate-600 font-medium">X (Este)</th>
                        <th className="px-4 py-2 text-left text-slate-600 font-medium">Y (Norte)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {importedData.vertices.slice(0, 10).map((vertex, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-600">{i + 1}</td>
                          <td className="px-4 py-2 font-mono text-slate-900">
                            {vertex[0].toFixed(2)}
                          </td>
                          <td className="px-4 py-2 font-mono text-slate-900">
                            {vertex[1].toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importedData.vertices.length > 10 && (
                    <div className="text-xs text-slate-500 mt-2 text-center">
                      ... y {importedData.vertices.length - 10} vértices más
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleClear}
                  className="px-6 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                >
                  Descartar
                </button>
                <button
                  onClick={handleUseData}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm hover:shadow-md"
                >
                  Usar estos Datos →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
