'use client';

import { useState } from 'react';
import { useEditorStore } from '@/lib/editor/store';
import { Layer, LayerType } from '@/types/editor';
import { nanoid } from 'nanoid';
import toast from 'react-hot-toast';

export function LayerPanel() {
  const { layers, selectedLayer, addLayer, removeLayer, toggleLayerVisibility, toggleLayerLock, selectLayer, updateLayer } = useEditorStore();
  const [isExpanded, setIsExpanded] = useState(true);

  const handleAddLayer = () => {
    const newLayer: Layer = {
      id: nanoid(),
      name: `Capa ${layers.length + 1}`,
      type: LayerType.LOTE,
      visible: true,
      locked: false,
      color: '#3B82F6',
      opacity: 1,
      elements: []
    };
    addLayer(newLayer);
    toast.success('Capa agregada');
  };

  const getLayerIcon = (type: LayerType) => {
    const icons = {
      [LayerType.LOTE]: '🏠',
      [LayerType.CALLE]: '🛣️',
      [LayerType.AREA_VERDE]: '🌳',
      [LayerType.AREA_COMUN]: '🏛️',
      [LayerType.CONSTRUCCION]: '🏗️',
      [LayerType.MEDICIONES]: '📏',
      [LayerType.ANOTACIONES]: '📝',
      [LayerType.COLINDANCIAS]: '🔗'
    };
    return icons[type] || '📍';
  };

  const getLayerColor = (type: LayerType) => {
    const colors = {
      [LayerType.LOTE]: '#3B82F6',
      [LayerType.CALLE]: '#10B981',
      [LayerType.AREA_VERDE]: '#22C55E',
      [LayerType.AREA_COMUN]: '#8B5CF6',
      [LayerType.CONSTRUCCION]: '#F59E0B',
      [LayerType.MEDICIONES]: '#EC4899',
      [LayerType.ANOTACIONES]: '#6366F1',
      [LayerType.COLINDANCIAS]: '#14B8A6'
    };
    return colors[type] || '#6B7280';
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 w-80 transition-colors">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between transition-colors">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 font-semibold text-gray-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition"
        >
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          CAPAS
        </button>
        <button
          onClick={handleAddLayer}
          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded transition"
          title="Agregar capa"
        >
          <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Layers List */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto">
          {layers.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">
                No hay capas todavía
              </p>
              <button
                onClick={handleAddLayer}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              >
                Agregar primera capa
              </button>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {layers.map((layer) => (
                <div
                  key={layer.id}
                  className={`group p-2 rounded-lg cursor-pointer transition ${
                    selectedLayer === layer.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-700 border border-transparent'
                  }`}
                  onClick={() => selectLayer(layer.id)}
                >
                  <div className="flex items-center gap-2">
                    {/* Visibility toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLayerVisibility(layer.id);
                      }}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded transition"
                      title={layer.visible ? 'Ocultar capa' : 'Mostrar capa'}
                    >
                      {layer.visible ? (
                        <svg className="w-4 h-4 text-gray-700 dark:text-slate-300" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-gray-400 dark:text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                          <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                        </svg>
                      )}
                    </button>

                    {/* Lock toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLayerLock(layer.id);
                      }}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded transition"
                      title={layer.locked ? 'Desbloquear capa' : 'Bloquear capa'}
                    >
                      {layer.locked ? (
                        <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-gray-400 dark:text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                        </svg>
                      )}
                    </button>

                    {/* Color indicator */}
                    <div
                      className="w-4 h-4 rounded border-2 border-white dark:border-slate-600 shadow-sm"
                      style={{ backgroundColor: layer.color || getLayerColor(layer.type) }}
                    />

                    {/* Icon and name */}
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-base">{getLayerIcon(layer.type)}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                        {layer.name}
                      </span>
                    </div>

                    {/* Element count */}
                    <span className="text-xs text-gray-500 dark:text-slate-400">
                      {layer.elements.length}
                    </span>

                    {/* Delete button (visible on hover) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`¿Eliminar capa "${layer.name}"?`)) {
                          removeLayer(layer.id);
                          toast.success('Capa eliminada');
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition"
                      title="Eliminar capa"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  {/* Layer properties (when selected) */}
                  {selectedLayer === layer.id && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-600 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
                          Opacidad
                        </label>
                        <span className="text-xs text-gray-600 dark:text-slate-400">
                          {Math.round(layer.opacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={layer.opacity * 100}
                        onChange={(e) => {
                          updateLayer(layer.id, { opacity: parseInt(e.target.value) / 100 });
                        }}
                        className="w-full h-1 bg-gray-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer with layer stats */}
      <div className="p-3 border-t border-gray-200 dark:border-slate-700 text-xs text-gray-600 dark:text-slate-400 transition-colors">
        <div className="flex justify-between">
          <span>{layers.length} capas</span>
          <span>{layers.reduce((sum, l) => sum + l.elements.length, 0)} elementos</span>
        </div>
      </div>
    </div>
  );
}
