'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { EditorHeader } from './EditorHeader';
import { Toolbar } from './Toolbar';
import { CADCanvas } from './CADCanvas';
import { MapView } from './MapView';
import { PropertyPanel } from './PropertyPanel';
import { StatusBar } from './StatusBar';
import { ValidationPanel } from './ValidationPanel';
import { WorkflowSteps } from './WorkflowSteps';
import { useEditorStore } from '@/lib/editor/store';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';
import { useGeometry } from '@/lib/hooks/useGeometry';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { Download, Save, Upload, Trash2, Send } from 'lucide-react';
import { GenerarPlanosRequest, LoteMetadata, Colindancia } from '@/types/planos';

type ViewMode = 'map' | 'canvas';

export default function ProfessionalEditorPage() {
    const {
        vertices,
        setVertices,
        config,
        reset
    } = useEditorStore();

    // Activar atajos de teclado
    useKeyboardShortcuts();

    // Cálculos geométricos en tiempo real
    const geometry = useGeometry(vertices);

    // Estado de vista (Mapa vs Canvas)
    const [viewMode, setViewMode] = useState<ViewMode>('map');
    const [mapCenter, setMapCenter] = useState<[number, number]>([-12.0464, -77.0428]);

    // Estados del flujo
    const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Datos del lote
    const [lote, setLote] = useState<LoteMetadata>({
        codigo: '',
        nombre: '',
        etapa: '',
        manzana: '',
        numeroLote: '',
        estado: 'libre',
        ubicacion: {
            departamento: 'Lima',
            provincia: 'Lima',
            distrito: '',
            urbanizacion: '',
            direccion: ''
        }
    });

    const [colindancias, setColindancias] = useState<Colindancia[]>([]);

    // Manejo de establecimiento del origen
    const handleOriginSet = useCallback((lat: number, lng: number) => {
        toast.success('Punto de origen establecido. Coordenadas relativas activadas.');
        setMapCenter([lat, lng]);
    }, []);

    // Manejo de selección de ubicación desde el mapa
    const handleLocationSelect = useCallback((coords: any, address?: string) => {
        toast.success('Ubicación seleccionada. Cambia a vista de dibujo para empezar.');
        
        if (address) {
            setLote(prev => ({
                ...prev,
                ubicacion: {
                    ...prev.ubicacion,
                    direccion: address
                }
            }));
        }
        
        setTimeout(() => {
            if (confirm('¿Quieres cambiar a la vista de dibujo para comenzar a crear el plano?')) {
                setViewMode('canvas');
                setCurrentStep(2);
            }
        }, 1000);
    }, []);

    // Handlers del flujo
    const handleNextStep = useCallback(() => {
        switch (currentStep) {
            case 1:
                if (!mapCenter) {
                    toast.error('Primero busca la ubicación del terreno en el mapa');
                    return;
                }
                setViewMode('canvas');
                setCurrentStep(2);
                toast.success('Paso 2: Dibuja el perímetro del terreno');
                break;
                
            case 2:
                if (vertices.length < 3) {
                    toast.error('Dibuja al menos 3 vértices antes de continuar');
                    return;
                }
                setViewMode('map');
                setCurrentStep(3);
                toast.success('Paso 3: Verifica que el plano esté correcto en el mapa');
                break;
                
            case 3:
                setViewMode('canvas');
                setCurrentStep(4);
                toast.success('Paso 4: Completa la información del lote y envía');
                break;
        }
    }, [currentStep, mapCenter, vertices]);

    const handlePrevStep = useCallback(() => {
        if (currentStep > 1) {
            setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
            
            if (currentStep === 2) setViewMode('map');
            if (currentStep === 3) setViewMode('canvas');
            if (currentStep === 4) setViewMode('map');
        }
    }, [currentStep]);

    // Enviar a la API
    const handleGeneratePlano = useCallback(async () => {
        if (vertices.length < 3) {
            toast.error('Se requieren al menos 3 vértices');
            return;
        }
        
        if (!lote.codigo || !lote.nombre) {
            toast.error('Completa el código y nombre del lote');
            return;
        }

        const apiKey = localStorage.getItem('apiKey');
        if (!apiKey) {
            toast.error('No se encontró tu API key. Vuelve a iniciar sesión o regístrate para obtener una.');
            return;
        }

        setIsSubmitting(true);

        try {
            const requestData: GenerarPlanosRequest = {
                vertices,
                dimensiones: geometry,
                lote: {
                    ...lote,
                    manzana: lote.manzana || 'A',
                    etapa: lote.etapa || 'I',
                    numeroLote: lote.numeroLote || '01'
                },
                colindancias: colindancias.length > 0 ? colindancias : [
                    { lado: 'norte', tipo: 'calle', nombre: 'Por definir' }
                ],
                config: {
                    incluirMemoriaDescriptiva: true,
                    incluirPlanoPerimetrico: true,
                    incluirPlanoUbicacion: true,
                    formatoPapel: 'A3',
                    orientacion: 'landscape',
                    incluirColindantesEnPlano: true
                }
            };

            const response = await fetch('/api/v1/planos/generar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey
                },
                body: JSON.stringify(requestData)
            });

            const result = await response.json();

            if (result.success) {
                toast.success('¡Plano generado exitosamente!');
                toast.success(`ID del plano: ${result.data?.planoId}`);
                
                if (result.data?.jobId) {
                    toast.success(`Job ID: ${result.data.jobId}. El plano se está generando...`, {
                        duration: 5000
                    });
                }

                setTimeout(() => {
                    if (confirm('¿Quieres crear otro plano? (Se limpiará el editor actual)')) {
                        reset();
                        setLote({
                            codigo: '',
                            nombre: '',
                            etapa: '',
                            manzana: '',
                            numeroLote: '',
                            estado: 'libre',
                            ubicacion: {
                                departamento: 'Lima',
                                provincia: 'Lima',
                                distrito: '',
                                urbanizacion: '',
                                direccion: ''
                            }
                        });
                        setColindancias([]);
                        setCurrentStep(1);
                        setViewMode('map');
                    }
                }, 2000);

            } else {
                toast.error(`Error: ${result.error?.message || 'Error desconocido'}`);
                console.error('API Error:', result.error);
            }

        } catch (error) {
            console.error('Error al generar plano:', error);
            toast.error('Error al conectar con el servidor');
        } finally {
            setIsSubmitting(false);
        }
    }, [vertices, geometry, lote, colindancias, reset]);

    // Handlers de guardado/exportación local
    const handleSave = () => {
        if (vertices.length < 3) {
            toast.error('Se requieren al menos 3 vértices para guardar');
            return;
        }

        const data = { lote, vertices, dimensiones: geometry, colindancias };
        localStorage.setItem('plano_draft', JSON.stringify(data));
        toast.success('Plano guardado localmente');
    };

    const handleExport = () => {
        if (vertices.length < 3) {
            toast.error('Se requieren al menos 3 vértices para exportar');
            return;
        }

        const data = {
            lote,
            vertices,
            dimensiones: geometry,
            colindancias,
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `plano_${lote.codigo || 'draft'}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        toast.success('Plano exportado exitosamente');
    };

    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target?.result as string);
                    
                    if (data.vertices && Array.isArray(data.vertices)) {
                        setVertices(data.vertices);
                    }
                    if (data.lote) {
                        setLote(data.lote);
                    }
                    if (data.colindancias) {
                        setColindancias(data.colindancias);
                    }
                    
                    toast.success('Plano importado exitosamente');
                } catch (error) {
                    toast.error('Error al importar el archivo');
                    console.error('Error:', error);
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    };

    const handleClear = () => {
        if (confirm('¿Estás seguro de que quieres limpiar todo el dibujo?')) {
            reset();
            setLote({
                codigo: '',
                nombre: '',
                etapa: '',
                manzana: '',
                numeroLote: '',
                estado: 'libre',
                ubicacion: {
                    departamento: 'Lima',
                    provincia: 'Lima',
                    distrito: '',
                    urbanizacion: '',
                    direccion: ''
                }
            });
            setColindancias([]);
            setCurrentStep(1);
            setViewMode('map');
            toast.success('Editor reiniciado');
        }
    };

    // Cargar borrador al iniciar
    useEffect(() => {
        const draft = localStorage.getItem('plano_draft');
        if (draft) {
            try {
                const data = JSON.parse(draft);
                if (data.vertices) {
                    setVertices(data.vertices);
                    toast('Borrador cargado', { icon: '📋' });
                    
                    if (data.vertices.length >= 3) {
                        setCurrentStep(2);
                        setViewMode('canvas');
                    }
                }
            } catch (error) {
                console.error('Error cargando borrador:', error);
            }
        }
    }, [setVertices]);

    // Auto-guardado cada 30 segundos
    useEffect(() => {
        const interval = setInterval(() => {
            if (vertices.length >= 3) {
                const data = { lote, vertices, dimensiones: geometry, colindancias };
                localStorage.setItem('plano_draft', JSON.stringify(data));
                console.log('Auto-guardado realizado');
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [vertices, lote, geometry, colindancias]);

    // Atajo Tab para cambiar vistas
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                setViewMode(prev => prev === 'map' ? 'canvas' : 'map');
                toast.success(`Vista: ${viewMode === 'map' ? 'Dibujo' : 'Mapa'}`);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [viewMode]);

    return (
        <ProtectedRoute>
            <div className="h-screen flex flex-col bg-gray-50 overflow-hidden font-sans">
                <Toaster 
                    position="top-right"
                    toastOptions={{
                        duration: 3000,
                        style: {
                            background: '#363636',
                            color: '#fff',
                        },
                    }}
                />

                {/* Header con Acciones */}
                <EditorHeader
                    title="Editor CAD Profesional"
                    subtitle={`${lote.nombre || 'Nuevo Proyecto'} - ${vertices.length} vértices`}
                    backTo="/dashboard"
                    actions={
                        <div className="flex gap-4 items-center">
                            {/* Workflow Steps */}
                            <WorkflowSteps currentStep={currentStep} />
                            
                            <div className="w-px h-8 bg-gray-300" />
                            
                            {/* Action Buttons */}
                            <div className="flex gap-2">
                            <button 
                                onClick={handleImport}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                            >
                                <Upload size={16} />
                                <span>Importar</span>
                            </button>
                            
                            <button 
                                onClick={handleClear}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 transition-colors shadow-sm"
                            >
                                <Trash2 size={16} />
                                <span>Limpiar</span>
                            </button>

                            <div className="w-px h-8 bg-gray-300" />
                            
                            <button 
                                onClick={handleSave}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                                disabled={vertices.length < 3}
                            >
                                <Save size={16} />
                                <span>Guardar</span>
                            </button>
                            
                            <button 
                                onClick={handleExport}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                                disabled={vertices.length < 3}
                            >
                                <Download size={16} />
                                <span>Exportar JSON</span>
                            </button>

                            <div className="w-px h-8 bg-gray-300" />
                            
                            <button 
                                onClick={handleGeneratePlano}
                                className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={vertices.length < 3 || !lote.codigo || !lote.nombre || isSubmitting}
                            >
                                <Send size={16} />
                                <span>{isSubmitting ? 'Generando...' : 'Generar Plano'}</span>
                            </button>
                            </div>
                        </div>
                    }
                />

                {/* Layout Principal */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Barra de Herramientas Lateral */}
                    <Toolbar 
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                    />

                    {/* Área de Trabajo Central */}
                    <main className="flex-1 relative flex flex-col min-w-0">
                        <div className="flex-1 relative bg-slate-100">
                            {viewMode === 'map' ? (
                                <MapView
                                    vertices={vertices}
                                    center={mapCenter}
                                    onLocationSelect={handleLocationSelect}
                                    onCenterChange={setMapCenter}
                                    onOriginSet={handleOriginSet}
                                />
                            ) : (
                                <CADCanvas
                                    vertices={vertices}
                                    onVerticesChange={setVertices}
                                    editable={true}
                                />
                            )}
                        </div>

                        {/* Barra de Estado Inferior */}
                        <StatusBar />
                    </main>

                    {/* Panel de Propiedades Derecho */}
                    <aside className="w-80 flex-shrink-0 shadow-xl z-20 flex flex-col overflow-hidden">
                        {/* Panel de Validación */}
                        <div className="p-4 border-b border-gray-200 bg-white">
                            <ValidationPanel
                                vertices={vertices}
                                lote={lote}
                            />
                        </div>

                        {/* Panel de Propiedades */}
                        <div className="flex-1 overflow-y-auto">
                            <PropertyPanel
                                lote={lote}
                                dimensiones={geometry}
                                colindancias={colindancias}
                                onLoteChange={setLote}
                                onColindanciasChange={setColindancias}
                                editable={true}
                            />
                        </div>
                    </aside>
                </div>
            </div>
        </ProtectedRoute>
    );
}
