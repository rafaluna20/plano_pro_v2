'use client';

import { useState, useCallback, useRef } from 'react';
import { parseFileContent, validateUTMCoordinates } from '@/lib/editor/importers';
import { UTMCoordinate } from '@/types/planos';
import toast from 'react-hot-toast';
import { Upload, FileText, AlertCircle, CheckCircle, X, Copy } from 'lucide-react';

interface ImportDataModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (vertices: UTMCoordinate[]) => void;
    title?: string;
    subtitle?: string;
}

export function ImportDataModal({ isOpen, onClose, onImport, title, subtitle }: ImportDataModalProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [importedData, setImportedData] = useState<{
        vertices: UTMCoordinate[];
        filename: string;
        warnings: string[];
    } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const supportedFormats = [
        { ext: '.csv', name: 'CSV', icon: '📄', desc: 'Coordenadas en formato CSV (x,y por línea)' },
        { ext: '.json', name: 'GeoJSON', icon: '🗺️', desc: 'Archivo GeoJSON con geometría' },
        { ext: '.geojson', name: 'GeoJSON', icon: '🗺️', desc: 'Archivo GeoJSON con geometría' },
        { ext: '.kml', name: 'KML', icon: '📍', desc: 'Archivo KML de Google Earth' },
        { ext: '.txt', name: 'Texto', icon: '📝', desc: 'Texto plano con coordenadas' },
    ];

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) await processFile(files[0]);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) await processFile(files[0]);
    };

    const processFile = async (file: File) => {
        setIsProcessing(true);
        try {
            const content = await file.text();
            const result = parseFileContent(file.name, content);

            if (!result.success) {
                toast.error(result.error || 'Error al procesar el archivo');
                return;
            }

            if (!result.vertices || result.vertices.length < 3) {
                toast.error('El archivo debe contener al menos 3 coordenadas');
                return;
            }

            const validation = validateUTMCoordinates(result.vertices);
            setImportedData({
                vertices: result.vertices,
                filename: file.name,
                warnings: validation.warnings,
            });

            if (validation.warnings.length > 0) {
                toast('Advertencias detectadas. Revisa las coordenadas.', { icon: '⚠️' });
            } else {
                toast.success(`✅ ${result.vertices.length} coordenadas importadas`);
            }
        } catch (error) {
            toast.error('Error al leer el archivo');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUseData = () => {
        if (importedData) {
            onImport(importedData.vertices);
            setImportedData(null);
            onClose();
        }
    };

    const handleCopyExample = (format: string) => {
        let example = '';
        if (format === 'csv') example = 'x,y\n284500.00,8670100.00\n284510.00,8670100.00\n284510.00,8670080.00\n284500.00,8670080.00';
        else if (format === 'geojson') example = '{"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [[[284500, 8670100], [284510, 8670100], [284510, 8670080], [284500, 8670080], [284500, 8670100]]]}}';
        else if (format === 'kml') example = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Placemark>\n<Polygon><outerBoundaryIs><LinearRing><coordinates>\n284500,8670100,0 284510,8670100,0 284510,8670080,0 284500,8670080,0 284500,8670100,0\n</coordinates></LinearRing></outerBoundaryIs></Polygon>\n</Placemark>\n</kml>';
        else example = '284500.00 8670100.00\n284510.00 8670100.00\n284510.00 8670080.00\n284500.00 8670080.00';

        navigator.clipboard.writeText(example);
        toast.success('Ejemplo copiado');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">{title || 'Importar Coordenadas'}</h3>
                        <p className="text-sm text-slate-500">{subtitle || 'Carga un archivo (CSV, GeoJSON, KML o TXT)'}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {!importedData ? (
                        <>
                            {/* Dropzone */}
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                                    } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-blue-500' : 'text-slate-300'}`} />
                                <p className="text-slate-900 font-medium mb-1">
                                    {isProcessing ? 'Procesando...' : 'Arrastra un archivo aquí'}
                                </p>
                                <p className="text-sm text-slate-500 mb-4">O haz clic para explorar tus archivos</p>
                                <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" accept=".csv,.json,.geojson,.kml,.txt" />
                                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                                    Seleccionar Archivo
                                </button>
                            </div>

                            {/* Formatos */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {supportedFormats.map(f => (
                                    <div key={f.ext} className="p-3 border border-slate-200 rounded-lg flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">{f.icon}</span>
                                            <div>
                                                <p className="text-xs font-bold text-slate-800">{f.name}</p>
                                                <p className="text-[10px] text-slate-500">{f.ext}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => handleCopyExample(f.ext.slice(1))} className="p-1 text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Copy size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="space-y-4">
                            {/* Vista previa de datos importados */}
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-4">
                                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white shrink-0">
                                    <CheckCircle size={24} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-emerald-900 font-bold">¡Datos listos para importar!</p>
                                    <p className="text-xs text-emerald-700">{importedData.filename} • {importedData.vertices.length} vértices detectados</p>
                                </div>
                                <button onClick={() => setImportedData(null)} className="text-xs text-slate-500 hover:text-red-600 font-medium">Cambiar</button>
                            </div>

                            {importedData.warnings.length > 0 && (
                                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3 text-amber-800">
                                    <AlertCircle size={20} className="shrink-0" />
                                    <div className="text-xs">
                                        <p className="font-bold mb-1">Advertencias:</p>
                                        <ul className="list-disc ml-4 space-y-0.5">
                                            {importedData.warnings.slice(0, 2).map((w, i) => <li key={i}>{w}</li>)}
                                            {importedData.warnings.length > 2 && <li>Y {importedData.warnings.length - 2} más...</li>}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-2">#</th>
                                            <th className="px-4 py-2">X (Este)</th>
                                            <th className="px-4 py-2">Y (Norte)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {importedData.vertices.slice(0, 5).map((v, i) => (
                                            <tr key={i}>
                                                <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                                                <td className="px-4 py-2 font-mono text-slate-700">{v[0].toFixed(3)}</td>
                                                <td className="px-4 py-2 font-mono text-slate-700">{v[1].toFixed(3)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {importedData.vertices.length > 5 && (
                                    <div className="p-2 text-center text-[10px] text-slate-400 bg-slate-50/50">
                                        Mostrando 5 de {importedData.vertices.length} vértices
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button onClick={() => setImportedData(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                                    Descartar
                                </button>
                                <button onClick={handleUseData} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all">
                                    Confirmar e Importar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
