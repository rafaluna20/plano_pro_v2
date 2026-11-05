'use client';

import { useState, useCallback, useRef } from 'react';
import { parseFileContent, validateUTMCoordinates } from '@/lib/editor/importers';
import { UTMCoordinate } from '@/types/planos';
import toast from 'react-hot-toast';
import { Upload, FileText, AlertCircle, CheckCircle, X, Copy, Download } from 'lucide-react';
import { EJEMPLOS_IMPORTACION, ejemploPorExtension } from '@/lib/editor/importExamples';
import { medidasPoligono, autoIntersecta, type Punto } from '@/lib/editor/geometryChecks';

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
        /** Avisos del lector (líneas ignoradas, varios polígonos...). */
        advertencias: string[];
        notas: string[];
        /** Si el archivo trae varios polígonos, todos, para elegir. */
        candidatos?: { nombre: string; vertices: UTMCoordinate[] }[];
    } | null>(null);
    const [indice, setIndice] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    // Un ejemplo por formato (lib/editor/importExamples.ts): mismo origen que la
    // prueba que verifica que todos se importan.
    const supportedFormats = EJEMPLOS_IMPORTACION;

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
            setIndice(0);
            setImportedData({
                vertices: result.vertices,
                filename: file.name,
                advertencias: result.advertencias ?? [],
                notas: result.notas ?? [],
                candidatos: result.candidatos,
            });

            const hayAvisos = validation.warnings.length > 0 || (result.advertencias?.length ?? 0) > 0;
            if (hayAvisos) {
                toast('Advertencias detectadas. Revisa la vista previa.', { icon: '⚠️' });
            } else if (result.notas && result.notas.length > 0) {
                toast.success(`✅ ${result.vertices.length} coordenadas importadas y convertidas a UTM`);
            } else {
                toast.success(`✅ ${result.vertices.length} coordenadas importadas`);
            }
        } catch (error) {
            toast.error('Error al leer el archivo');
        } finally {
            setIsProcessing(false);
        }
    };

    // Polígono que se va a importar (el elegido, si el archivo trae varios) y sus
    // medidas/avisos, calculados al vuelo para que cambien al elegir otro.
    const actuales: UTMCoordinate[] | null = importedData
        ? (importedData.candidatos?.[indice]?.vertices ?? importedData.vertices)
        : null;
    const medidas = actuales ? medidasPoligono(actuales as Punto[]) : null;
    const avisos: string[] =
        importedData && actuales && medidas
            ? [
                  ...importedData.advertencias,
                  ...(autoIntersecta(actuales as Punto[])
                      ? ['El contorno se cruza a sí mismo (hay lados que se atraviesan): revisa el orden de los vértices.']
                      : []),
                  ...(medidas.area < 1
                      ? [`El área es de solo ${medidas.area.toFixed(2)} m²: revisa las unidades o los vértices.`]
                      : []),
                  ...validateUTMCoordinates(actuales).warnings,
              ]
            : [];

    const handleUseData = () => {
        if (importedData) {
            onImport(actuales ?? importedData.vertices);
            setImportedData(null);
            onClose();
        }
    };

    const handleCopyExample = async (ext: string) => {
        const ej = ejemploPorExtension(ext);
        if (!ej) return;
        try {
            await navigator.clipboard.writeText(ej.contenido);
            toast.success(`Ejemplo ${ej.formato} (${ej.ext}) copiado`);
        } catch {
            toast.error('No se pudo copiar. Usa "Descargar".');
        }
    };

    const handleDownloadExample = (ext: string) => {
        const ej = ejemploPorExtension(ext);
        if (!ej) return;
        const url = URL.createObjectURL(new Blob([ej.contenido], { type: `${ej.mime};charset=utf-8` }));
        const a = document.createElement('a');
        a.href = url;
        a.download = ej.archivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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

                            {/* Formatos, cada uno con su ejemplo */}
                            <p className="text-xs text-slate-500">
                                <b>CSV y TXT:</b> UTM en metros (WGS84, zona 18S), X = Este, Y = Norte. <b>GeoJSON y KML:</b> en grados
                                lon/lat (lo normal) y se convierten solos a UTM 18S. Descarga un ejemplo para ver el formato exacto.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {supportedFormats.map(f => (
                                    <div key={f.ext} className="p-3 border border-slate-200 rounded-lg">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="text-xl">{f.icono}</span>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-slate-800">{f.formato}</p>
                                                    <p className="text-[10px] text-slate-500">{f.ext}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={() => handleCopyExample(f.ext)}
                                                    title={`Copiar ejemplo ${f.ext}`}
                                                    className="px-2 py-1 text-[11px] font-medium text-slate-600 border border-slate-200 rounded-md hover:text-blue-600 hover:border-blue-300 flex items-center gap-1"
                                                >
                                                    <Copy size={12} /> Copiar
                                                </button>
                                                <button
                                                    onClick={() => handleDownloadExample(f.ext)}
                                                    title={`Descargar ${f.archivo}`}
                                                    className="px-2 py-1 text-[11px] font-medium text-slate-600 border border-slate-200 rounded-md hover:text-blue-600 hover:border-blue-300 flex items-center gap-1"
                                                >
                                                    <Download size={12} /> Descargar
                                                </button>
                                            </div>
                                        </div>
                                        <p className="mt-2 text-[11px] leading-snug text-slate-500">{f.descripcion}</p>
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
                                    <p className="text-xs text-emerald-700">{importedData.filename} • {actuales!.length} vértices detectados</p>
                                </div>
                                <button onClick={() => setImportedData(null)} className="text-xs text-slate-500 hover:text-red-600 font-medium">Cambiar</button>
                            </div>

                            {importedData.notas.length > 0 && (
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-800">
                                    <AlertCircle size={20} className="shrink-0" />
                                    <ul className="text-xs list-disc ml-4 space-y-0.5">
                                        {importedData.notas.map((n, i) => <li key={i}>{n}</li>)}
                                    </ul>
                                </div>
                            )}

                            {avisos.length > 0 && (
                                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3 text-amber-800">
                                    <AlertCircle size={20} className="shrink-0" />
                                    <div className="text-xs">
                                        <p className="font-bold mb-1">Revisa antes de importar:</p>
                                        <ul className="list-disc ml-4 space-y-0.5">
                                            {avisos.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
                                            {avisos.length > 5 && <li>Y {avisos.length - 5} más...</li>}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {importedData.candidatos && importedData.candidatos.length > 1 && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                                        El archivo trae {importedData.candidatos.length} polígonos: elige cuál importar
                                    </label>
                                    <select
                                        value={indice}
                                        onChange={(e) => setIndice(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-sm"
                                    >
                                        {importedData.candidatos.map((c, i) => (
                                            <option key={i} value={i}>
                                                {c.nombre} ({c.vertices.length} vértices)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Vista previa del contorno: permite ver de inmediato un lote girado, cruzado o de otro lugar */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
                                <div className="sm:col-span-2 border border-slate-200 rounded-xl bg-slate-50 p-2">
                                    <VistaPreviaPoligono vertices={actuales!} />
                                </div>
                                <dl className="border border-slate-200 rounded-xl p-3 text-xs space-y-2 self-stretch">
                                    <div><dt className="text-slate-500">Área</dt><dd className="font-mono font-bold text-slate-800">{medidas!.area.toFixed(2)} m²</dd></div>
                                    <div><dt className="text-slate-500">Perímetro</dt><dd className="font-mono font-bold text-slate-800">{medidas!.perimetro.toFixed(2)} m</dd></div>
                                    <div><dt className="text-slate-500">Extensión (E-O × N-S)</dt><dd className="font-mono font-bold text-slate-800">{medidas!.ancho.toFixed(2)} × {medidas!.alto.toFixed(2)} m</dd></div>
                                    <div><dt className="text-slate-500">Vértices</dt><dd className="font-mono font-bold text-slate-800">{actuales!.length}</dd></div>
                                </dl>
                            </div>

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
                                        {actuales!.slice(0, 5).map((v, i) => (
                                            <tr key={i}>
                                                <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                                                <td className="px-4 py-2 font-mono text-slate-700">{v[0].toFixed(3)}</td>
                                                <td className="px-4 py-2 font-mono text-slate-700">{v[1].toFixed(3)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {actuales!.length > 5 && (
                                    <div className="p-2 text-center text-[10px] text-slate-400 bg-slate-50/50">
                                        Mostrando 5 de {actuales!.length} vértices
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

/** Dibuja el contorno (SVG) con sus vértices numerados, con el norte arriba. */
function VistaPreviaPoligono({ vertices }: { vertices: UTMCoordinate[] }) {
    const W = 360;
    const H = 200;
    const P = 24;
    const xs = vertices.map((v) => v[0]);
    const ys = vertices.map((v) => v[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const ancho = Math.max(Math.max(...xs) - minX, 1e-6);
    const alto = Math.max(Math.max(...ys) - minY, 1e-6);
    const esc = Math.min((W - 2 * P) / ancho, (H - 2 * P) / alto);
    const offX = (W - ancho * esc) / 2;
    const offY = (H - alto * esc) / 2;
    const pt = (v: UTMCoordinate): [number, number] => [offX + (v[0] - minX) * esc, H - offY - (v[1] - minY) * esc];
    const puntos = vertices.map((v) => pt(v).join(',')).join(' ');
    const etiquetar = vertices.length <= 40;

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48" role="img" aria-label="Vista previa del contorno importado">
            <polygon points={puntos} fill="rgba(37,99,235,0.12)" stroke="#2563eb" strokeWidth={1.5} strokeLinejoin="round" />
            {vertices.map((v, i) => {
                const [x, y] = pt(v);
                return (
                    <g key={i}>
                        <circle cx={x} cy={y} r={i === 0 ? 4 : 2.5} fill={i === 0 ? '#dc2626' : '#2563eb'} />
                        {etiquetar && (
                            <text x={x + 5} y={y - 5} fontSize={9} fill="#334155">{i + 1}</text>
                        )}
                    </g>
                );
            })}
            <text x={W - 14} y={16} fontSize={11} fontWeight="bold" fill="#475569" textAnchor="middle">N</text>
            <path d={`M ${W - 14} 20 L ${W - 14} 34`} stroke="#475569" strokeWidth={1.5} />
            <text x={8} y={H - 8} fontSize={9} fill="#64748b">● rojo = vértice 1</text>
        </svg>
    );
}
