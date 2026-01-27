'use client';

import { InputMethod } from '@/types/editor';
import { useWizardStore } from '@/lib/editor/wizardStore';
import toast from 'react-hot-toast';

export function WizardStep1_Method() {
  const { method, setMethod } = useWizardStore();

  const methods = [
    {
      id: InputMethod.MANUAL,
      icon: '✏️',
      title: 'Dibujo Manual',
      description: 'Dibuja directamente en el mapa con herramientas interactivas',
      features: ['Click para agregar puntos', 'Edición en tiempo real', 'Vista previa inmediata'],
      badge: 'Intuitivo',
      badgeColor: 'bg-blue-100 text-blue-700'
    },
    {
      id: InputMethod.COORDINATES,
      icon: '📊',
      title: 'Ingresar Coordenadas',
      description: 'Ingresa tabla de coordenadas UTM manualmente',
      features: ['Precisión milimétrica', 'Validación automática', 'Cálculo de dimensiones'],
      badge: 'Preciso',
      badgeColor: 'bg-green-100 text-green-700'
    },
    {
      id: InputMethod.IMPORT,
      icon: '📁',
      title: 'Importar Archivo',
      description: 'Carga archivos CSV, Excel, GeoJSON o KML',
      features: ['Múltiples formatos', 'Detección automática', 'Validación de datos'],
      badge: 'Rápido',
      badgeColor: 'bg-purple-100 text-purple-700'
    },
    {
      id: InputMethod.TEMPLATE,
      icon: '📋',
      title: 'Usar Plantilla',
      description: 'Selecciona de diseños predefinidos',
      features: ['4 plantillas listas', 'Personalización fácil', 'Resultados inmediatos'],
      badge: 'Fácil',
      badgeColor: 'bg-amber-100 text-amber-700'
    }
  ];

  const handleSelectMethod = (selectedMethod: InputMethod) => {
    setMethod(selectedMethod);
    toast.success(`Método "${methods.find(m => m.id === selectedMethod)?.title}" seleccionado`);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          Selecciona el Método de Entrada
        </h3>
        <p className="text-gray-600">
          Elige cómo deseas ingresar las coordenadas de tu lote
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {methods.map((m) => (
          <button
            key={m.id}
            onClick={() => handleSelectMethod(m.id)}
            className={`p-6 border-2 rounded-lg transition-all duration-200 text-left ${
              method === m.id
                ? 'border-blue-600 bg-blue-50 shadow-lg ring-2 ring-blue-200'
                : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="text-4xl">{m.icon}</div>
              <span className={`text-xs px-2 py-1 rounded font-medium ${m.badgeColor}`}>
                {m.badge}
              </span>
            </div>

            {/* Title and description */}
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              {m.title}
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              {m.description}
            </p>

            {/* Features */}
            <ul className="space-y-2">
              {m.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                  <svg
                    className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {/* Selected indicator */}
            {method === m.id && (
              <div className="mt-4 pt-4 border-t border-blue-200 flex items-center gap-2 text-sm font-medium text-blue-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Método Seleccionado
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Help section */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-blue-900 mb-2">
              💡 Recomendaciones
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span><strong>Dibujo Manual:</strong> Ideal si conoces la ubicación pero no tienes coordenadas exactas</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span><strong>Coordenadas:</strong> Perfecto cuando tienes datos de levantamiento topográfico</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span><strong>Importar:</strong> Ahorra tiempo si ya tienes un archivo con los datos</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span><strong>Plantilla:</strong> Más rápido para lotes rectangulares estándar</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
