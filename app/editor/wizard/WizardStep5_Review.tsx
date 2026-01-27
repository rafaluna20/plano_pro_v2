'use client';

import { useWizardStore } from '@/lib/editor/wizardStore';
import { useState } from 'react';
import toast from 'react-hot-toast';

export function WizardStep5_Review() {
  const { method, vertices, lote, colindancias } = useWizardStore();
  const [isGenerating, setIsGenerating] = useState(false);

  const calculateArea = () => {
    if (vertices.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      area += vertices[i][0] * vertices[j][1];
      area -= vertices[j][0] * vertices[i][1];
    }
    return Math.abs(area / 2);
  };

  const calculatePerimeter = () => {
    if (vertices.length < 2) return 0;
    let perimeter = 0;
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      const dx = vertices[j][0] - vertices[i][0];
      const dy = vertices[j][1] - vertices[i][1];
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    return perimeter;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    toast.loading('Generando plano...', { duration: 2000 });
    
    // Simulación de generación
    setTimeout(() => {
      setIsGenerating(false);
      toast.success('¡Plano generado exitosamente!');
    }, 2000);
  };

  const validations = [
    { id: 1, text: 'Mínimo 3 vértices definidos', passed: vertices.length >= 3 },
    { id: 2, text: 'Código de lote válido', passed: !!lote.codigo },
    { id: 3, text: 'Nombre de lote definido', passed: !!lote.nombre },
    { id: 4, text: 'Área dentro de límites', passed: calculateArea() >= 50 && calculateArea() <= 5000 }
  ];

  const allValidationsPassed = validations.every(v => v.passed);

  return (
    <div className="max-w-4xl mx-auto">
      <h3 className="text-2xl font-bold text-gray-900 mb-2">
        Revisa y Genera el Plano
      </h3>
      <p className="text-gray-600 mb-8">
        Verifica que toda la información sea correcta antes de generar
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resumen */}
        <div className="space-y-6">
          {/* Información del lote */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              📋 Resumen del Plano
            </h4>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">Código:</span>
                <span className="text-sm font-semibold text-gray-900">{lote.codigo || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">Nombre:</span>
                <span className="text-sm text-gray-900">{lote.nombre || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">Ubicación:</span>
                <span className="text-sm text-gray-900">
                  Etapa {lote.etapa || '-'} | Mz {lote.manzana || '-'} | Lote {lote.numeroLote || '-'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-medium text-gray-700">Estado:</span>
                <span className={`text-sm px-2 py-1 rounded ${
                  lote.estado === 'libre' ? 'bg-green-100 text-green-700' :
                  lote.estado === 'separado' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {lote.estado || 'Libre'}
                </span>
              </div>
            </div>
          </div>

          {/* Dimensiones */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              📐 Dimensiones
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-xs text-blue-700 mb-1">Área Total</p>
                <p className="text-2xl font-bold text-blue-900">{calculateArea().toFixed(2)}</p>
                <p className="text-xs text-blue-700">m²</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-xs text-green-700 mb-1">Perímetro</p>
                <p className="text-2xl font-bold text-green-900">{calculatePerimeter().toFixed(2)}</p>
                <p className="text-xs text-green-700">m</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-xs text-purple-700 mb-1">Vértices</p>
                <p className="text-2xl font-bold text-purple-900">{vertices.length}</p>
                <p className="text-xs text-purple-700">puntos</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-4">
                <p className="text-xs text-amber-700 mb-1">Colindancias</p>
                <p className="text-2xl font-bold text-amber-900">{colindancias.length}</p>
                <p className="text-xs text-amber-700">definidas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Validaciones y Opciones */}
        <div className="space-y-6">
          {/* Validaciones */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">
                ✅ Validaciones
              </h4>
              <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                allValidationsPassed 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {validations.filter(v => v.passed).length}/{validations.length}
              </span>
            </div>
            
            <div className="space-y-2">
              {validations.map((validation) => (
                <div 
                  key={validation.id}
                  className={`flex items-start gap-2 p-2 rounded ${
                    validation.passed ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  {validation.passed ? (
                    <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className={`text-sm ${validation.passed ? 'text-green-800' : 'text-red-800'}`}>
                    {validation.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Opciones de generación */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              ⚙️ Opciones de Generación
            </h4>
            
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded text-blue-600" />
                <span className="text-sm text-gray-700">Incluir Memoria Descriptiva</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded text-blue-600" />
                <span className="text-sm text-gray-700">Incluir Plano Perimétrico</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded text-blue-600" />
                <span className="text-sm text-gray-700">Incluir Plano de Ubicación</span>
              </label>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Formato:</label>
                <select className="text-sm border-gray-300 rounded">
                  <option>A4</option>
                  <option>A3</option>
                  <option>Legal</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Orientación:</label>
                <select className="text-sm border-gray-300 rounded">
                  <option>Vertical</option>
                  <option>Horizontal</option>
                </select>
              </div>
            </div>
          </div>

          {/* Botón de generación */}
          <button
            onClick={handleGenerate}
            disabled={!allValidationsPassed || isGenerating}
            className={`w-full py-4 rounded-lg font-semibold text-lg transition-all ${
              allValidationsPassed && !isGenerating
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generando...
              </span>
            ) : (
              '🎯 GENERAR PLANO'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
