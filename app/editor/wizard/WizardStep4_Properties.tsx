'use client';

import { useWizardStore } from '@/lib/editor/wizardStore';
import { Colindancia } from '@/types/planos';
import toast from 'react-hot-toast';

export function WizardStep4_Properties() {
  const { lote, colindancias, updateLote, setColindancias } = useWizardStore();

  const handleAddColindancia = () => {
    const newColindancia: Colindancia = {
      lado: 'norte',
      tipo: 'lote',
      nombre: ''
    };
    setColindancias([...colindancias, newColindancia]);
    toast.success('Colindancia agregada');
  };

  const handleUpdateColindancia = (index: number, field: keyof Colindancia, value: any) => {
    const newColindancias = [...colindancias];
    newColindancias[index] = { ...newColindancias[index], [field]: value };
    setColindancias(newColindancias);
  };

  const handleRemoveColindancia = (index: number) => {
    const newColindancias = colindancias.filter((_, i) => i !== index);
    setColindancias(newColindancias);
    toast.success('Colindancia eliminada');
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h3 className="text-2xl font-bold text-gray-900 mb-2">
        Completa las Propiedades del Lote
      </h3>
      <p className="text-gray-600 mb-8">
        Ingresa la información básica y colindancias
      </p>

      {/* Información Básica */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-blue-600 rounded"></span>
          Información Básica
        </h4>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código del Lote <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={lote.codigo || ''}
              onChange={(e) => updateLote({ codigo: e.target.value })}
              placeholder="E02MZT011"
              className="editor-input"
            />
            <p className="mt-1 text-xs text-gray-500">
              Ejemplo: E02MZT011 (Etapa-Manzana-Lote)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Lote <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={lote.nombre || ''}
              onChange={(e) => updateLote({ nombre: e.target.value })}
              placeholder="Etapa 02 Manzana T Lote 11"
              className="editor-input"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Etapa
              </label>
              <input
                type="text"
                value={lote.etapa || ''}
                onChange={(e) => updateLote({ etapa: e.target.value })}
                placeholder="02"
                className="editor-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Manzana
              </label>
              <input
                type="text"
                value={lote.manzana || ''}
                onChange={(e) => updateLote({ manzana: e.target.value })}
                placeholder="T"
                className="editor-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lote
              </label>
              <input
                type="text"
                value={lote.numeroLote || ''}
                onChange={(e) => updateLote({ numeroLote: e.target.value })}
                placeholder="11"
                className="editor-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              value={lote.estado || 'libre'}
              onChange={(e) => updateLote({ estado: e.target.value as any })}
              className="editor-input"
            >
              <option value="libre">Libre</option>
              <option value="separado">Separado</option>
              <option value="vendido">Vendido</option>
            </select>
          </div>
        </div>
      </div>

      {/* Colindancias */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-1 h-5 bg-orange-600 rounded"></span>
            Colindancias
          </h4>
          <button
            onClick={handleAddColindancia}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-600 rounded-md hover:bg-blue-50 transition"
          >
            + Agregar
          </button>
        </div>

        {colindancias.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-500 text-sm mb-3">
              No hay colindancias definidas
            </p>
            <button
              onClick={handleAddColindancia}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Agregar primera colindancia
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {colindancias.map((col, index) => (
              <div
                key={index}
                className="p-4 bg-gray-50 rounded-md border border-gray-200"
              >
                <div className="grid grid-cols-12 gap-3 items-start">
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Lado
                    </label>
                    <select
                      value={col.lado}
                      onChange={(e) => handleUpdateColindancia(index, 'lado', e.target.value)}
                      className="editor-input text-sm"
                    >
                      <option value="norte">Norte</option>
                      <option value="sur">Sur</option>
                      <option value="este">Este</option>
                      <option value="oeste">Oeste</option>
                      <option value="frente">Frente</option>
                      <option value="fondo">Fondo</option>
                      <option value="derecha">Derecha</option>
                      <option value="izquierda">Izquierda</option>
                    </select>
                  </div>

                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Tipo
                    </label>
                    <select
                      value={col.tipo}
                      onChange={(e) => handleUpdateColindancia(index, 'tipo', e.target.value)}
                      className="editor-input text-sm"
                    >
                      <option value="lote">Lote</option>
                      <option value="calle">Calle</option>
                      <option value="area_verde">Área Verde</option>
                      <option value="area_comun">Área Común</option>
                    </select>
                  </div>

                  <div className="col-span-5">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={col.nombre}
                      onChange={(e) => handleUpdateColindancia(index, 'nombre', e.target.value)}
                      placeholder="Ej: Lote 12, Av. Principal"
                      className="editor-input text-sm"
                    />
                  </div>

                  <div className="col-span-1 flex items-end">
                    <button
                      onClick={() => handleRemoveColindancia(index)}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition"
                      title="Eliminar"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {col.tipo === 'lote' && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Propietario (opcional)
                    </label>
                    <input
                      type="text"
                      value={col.propietario || ''}
                      onChange={(e) => handleUpdateColindancia(index, 'propietario', e.target.value)}
                      placeholder="Nombre del propietario"
                      className="editor-input text-sm"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validation message */}
      {(!lote.codigo || !lote.nombre) && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            ⚠️ Los campos marcados con <span className="text-red-500">*</span> son obligatorios para continuar
          </p>
        </div>
      )}
    </div>
  );
}
