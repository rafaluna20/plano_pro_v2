'use client';

import { useWizardStore } from '@/lib/editor/wizardStore';

export function WizardStep3_Edit() {
  const { vertices } = useWizardStore();

  return (
    <div className="max-w-4xl mx-auto">
      <h3 className="text-2xl font-bold text-gray-900 mb-4">
        Ajusta el Polígono en el Mapa
      </h3>
      <p className="text-gray-600 mb-6">
        Visualiza y edita tu lote en el mapa interactivo
      </p>

      <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
        <div className="text-6xl mb-4">🗺️</div>
        <h4 className="text-lg font-semibold text-gray-700 mb-2">
          Mapa Interactivo (En Desarrollo)
        </h4>
        <p className="text-gray-600 mb-4">
          Aquí se mostrará el mapa interactivo con Leaflet donde podrás visualizar y editar los vértices
        </p>
        
        {vertices.length >= 3 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md mx-auto mt-6">
            <p className="text-sm font-medium text-green-900 mb-2">
              ✓ Polígono Válido
            </p>
            <p className="text-sm text-green-700">
              {vertices.length} vértices detectados. Por ahora puedes continuar al siguiente paso.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
