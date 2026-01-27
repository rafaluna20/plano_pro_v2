'use client';

import { useState } from 'react';
import { PlanoTemplate } from '@/types/editor';
import { LOTE_TEMPLATES, calculateTemplateArea, calculateTemplatePerimeter } from '@/lib/editor/templates';
import { useWizardStore } from '@/lib/editor/wizardStore';
import { InputMethod } from '@/types/editor';
import toast from 'react-hot-toast';
import { Check, Info } from 'lucide-react';

export function TemplateSelector() {
  const [selectedTemplate, setSelectedTemplate] = useState<PlanoTemplate | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { setMethod, setVertices, updateLote } = useWizardStore();

  // Filtrar plantillas por categoría
  const filteredTemplates = selectedCategory === 'all'
    ? LOTE_TEMPLATES
    : LOTE_TEMPLATES.filter(t => t.category === selectedCategory);

  // Generar SVG de previsualización
  const generatePreviewSVG = (template: PlanoTemplate) => {
    const vertices = template.vertices;
    if (vertices.length < 3) return null;

    // Calcular bounding box
    const xs = vertices.map(v => v[0]);
    const ys = vertices.map(v => v[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = maxX - minX;
    const height = maxY - minY;

    // Escalar para el viewport (120x120)
    const viewportSize = 120;
    const scale = Math.min(viewportSize / width, viewportSize / height) * 0.8;
    const offsetX = (viewportSize - width * scale) / 2;
    const offsetY = (viewportSize - height * scale) / 2;

    // Generar path
    const points = vertices.map(v => {
      const x = (v[0] - minX) * scale + offsetX;
      const y = viewportSize - ((v[1] - minY) * scale + offsetY);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');

    return (
      <svg width="120" height="120" viewBox="0 0 120 120" className="mx-auto">
        <polygon
          points={points}
          fill="rgba(59, 130, 246, 0.1)"
          stroke="rgb(59, 130, 246)"
          strokeWidth="2"
        />
        {/* Puntos de vértices */}
        {vertices.map((v, i) => {
          const x = (v[0] - minX) * scale + offsetX;
          const y = viewportSize - ((v[1] - minY) * scale + offsetY);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              fill="rgb(59, 130, 246)"
            />
          );
        })}
      </svg>
    );
  };

  // Categorías con iconos
  const categories = [
    { id: 'all', name: 'Todas', icon: '🏘️' },
    { id: 'residencial', name: 'Residencial', icon: '🏠' },
    { id: 'comercial', name: 'Comercial', icon: '🏪' },
    { id: 'industrial', name: 'Industrial', icon: '🏭' },
    { id: 'irregular', name: 'Irregular', icon: '🔷' },
  ];

  const handleSelectTemplate = (template: PlanoTemplate) => {
    setSelectedTemplate(template);
    toast.success(`Plantilla "${template.name}" seleccionada`);
  };

  const handleUseTemplate = () => {
    if (!selectedTemplate) {
      toast.error('Selecciona una plantilla primero');
      return;
    }

    // Cargar plantilla en el wizard store
    setMethod(InputMethod.TEMPLATE);
    setVertices(selectedTemplate.vertices);
    
    if (selectedTemplate.metadata) {
      updateLote(selectedTemplate.metadata);
    }

    toast.success('¡Plantilla cargada! Continuando al siguiente paso...');
    
    // Aquí podrías navegar al siguiente paso o modo
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Seleccionar Plantilla de Lote
        </h2>
        <p className="text-slate-600">
          Elige una plantilla predefinida para empezar rápidamente
        </p>
      </div>

      {/* Category Filter */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span className="mr-2">{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>
        <div className="mt-3 text-sm text-slate-600">
          Mostrando {filteredTemplates.length} plantilla{filteredTemplates.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTemplates.map(template => {
            const isSelected = selectedTemplate?.id === template.id;
            const area = calculateTemplateArea(template.vertices);
            const perimeter = calculateTemplatePerimeter(template.vertices);

            return (
              <div
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className={`bg-white rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                  isSelected
                    ? 'border-blue-600 shadow-md ring-2 ring-blue-200'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                {/* Preview */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 relative">
                  {generatePreviewSVG(template)}
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-base font-semibold text-slate-900 leading-tight">
                      {template.name}
                    </h3>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      template.category === 'residencial' ? 'bg-green-100 text-green-700' :
                      template.category === 'comercial' ? 'bg-blue-100 text-blue-700' :
                      template.category === 'industrial' ? 'bg-purple-100 text-purple-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {template.category}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                    {template.description}
                  </p>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 rounded px-2 py-1.5">
                      <div className="text-slate-500">Área</div>
                      <div className="font-semibold text-slate-900">
                        {area.toFixed(0)} m²
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded px-2 py-1.5">
                      <div className="text-slate-500">Perímetro</div>
                      <div className="font-semibold text-slate-900">
                        {perimeter.toFixed(1)} m
                      </div>
                    </div>
                  </div>

                  {/* Vertices count */}
                  <div className="mt-2 text-xs text-slate-500">
                    {template.vertices.length} vértices
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No hay plantillas en esta categoría
            </h3>
            <p className="text-slate-600">
              Prueba seleccionando otra categoría
            </p>
          </div>
        )}
      </div>

      {/* Footer with action */}
      {selectedTemplate && (
        <div className="bg-white border-t border-slate-200 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start gap-4 mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">
                  Plantilla Seleccionada: {selectedTemplate.name}
                </h4>
                <p className="text-sm text-blue-800">
                  {selectedTemplate.description}
                </p>
                <div className="mt-2 flex gap-4 text-xs text-blue-700">
                  <span>
                    <strong>Área:</strong> {calculateTemplateArea(selectedTemplate.vertices).toFixed(0)} m²
                  </span>
                  <span>
                    <strong>Código:</strong> {selectedTemplate.metadata?.codigo}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedTemplate(null)}
                className="px-6 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUseTemplate}
                className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm hover:shadow-md"
              >
                Usar esta Plantilla →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
