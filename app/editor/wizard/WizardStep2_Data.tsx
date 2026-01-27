'use client';

import { useState } from 'react';
import { useWizardStore } from '@/lib/editor/wizardStore';
import { UTMCoordinate } from '@/types/planos';
import { InputMethod } from '@/types/editor';
import toast from 'react-hot-toast';

export function WizardStep2_Data() {
  const { method, vertices, setVertices } = useWizardStore();
  const [newVertex, setNewVertex] = useState({ x: '', y: '' });

  const handleAddVertex = () => {
    const x = parseFloat(newVertex.x);
    const y = parseFloat(newVertex.y);

    if (isNaN(x) || isNaN(y)) {
      toast.error('Ingresa coordenadas válidas');
      return;
    }

    // Validar que sean coordenadas UTM válidas para Perú (Zona 18S)
    if (x < 100000 || x > 900000 || y < 8000000 || y > 9200000) {
      toast.error('Coordenadas fuera del rango válido para Perú (Zona 18S)');
      return;
    }

    const newVertices: UTMCoordinate[] = [...vertices, [x, y]];
    setVertices(newVertices);
    setNewVertex({ x: '', y: '' });
    toast.success(`Vértice ${newVertices.length} agregado`);
  };

  const handleRemoveVertex = (index: number) => {
    const newVertices = vertices.filter((_, i) => i !== index);
    setVertices(newVertices);
    toast.success('Vértice eliminado');
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const lines = text.trim().split('\n');
      const newVertices: UTMCoordinate[] = [];

      for (const line of lines) {
        const parts = line.split(/[,\t\s]+/).filter(p => p.trim());
        if (parts.length >= 2) {
          const x = parseFloat(parts[0]);
          const y = parseFloat(parts[1]);
          if (!isNaN(x) && !isNaN(y)) {
            newVertices.push([x, y]);
          }
        }
      }

      if (newVertices.length > 0) {
        setVertices(newVertices);
        toast.success(`${newVertices.length} vértices importados desde el portapapeles`);
      } else {
        toast.error('No se encontraron coordenadas válidas en el portapapeles');
      }
    } catch (error) {
      toast.error('Error al leer del portapapeles');
    }
  };

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

  const renderMethodSpecificContent = () => {
    switch (method) {
      case InputMethod.COORDINATES:
        return renderCoordinatesInput();
      case InputMethod.MANUAL:
        return renderManualDrawing();
      case InputMethod.IMPORT:
        return renderImportFile();
      case InputMethod.TEMPLATE:
        return renderTemplateSelection();
      default:
        return <p className="text-gray-500">Selecciona un método en el paso anterior</p>;
    }
  };

  const renderCoordinatesInput = () => (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-4">
        Ingresa las Coordenadas UTM
      </h3>
      <p className="text-gray-600 mb-6">
        Sistema: UTM Zona 18S (Perú)
      </p>

      {/* Table */}
      <div className="border border-gray-300 rounded-lg overflow-hidden mb-4">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                Vértice
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                Este (X)
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                Norte (Y)
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {vertices.map((vertex, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {index + 1}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 font-mono">
                  {vertex[0].toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 font-mono">
                  {vertex[1].toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleRemoveVertex(index)}
                    className="text-red-600 hover:text-red-800 transition"
                    title="Eliminar vértice"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add new vertex */}
      <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Agregar Vértice
        </h4>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Este (X)
            </label>
            <input
              type="number"
              value={newVertex.x}
              onChange={(e) => setNewVertex({ ...newVertex, x: e.target.value })}
              placeholder="276500.00"
              className="editor-input"
              step="0.01"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Norte (Y)
            </label>
            <input
              type="number"
              value={newVertex.y}
              onChange={(e) => setNewVertex({ ...newVertex, y: e.target.value })}
              placeholder="8664500.00"
              className="editor-input"
              step="0.01"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAddVertex}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm font-medium"
            >
              + Agregar
            </button>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={handlePasteFromClipboard}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
          </svg>
          Pegar desde Portapapeles
        </button>
      </div>

      {/* Statistics */}
      {vertices.length >= 3 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-green-900 mb-3">
            ✓ Estadísticas Calculadas
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-green-700">Vértices</p>
              <p className="text-lg font-bold text-green-900">{vertices.length}</p>
            </div>
            <div>
              <p className="text-xs text-green-700">Área</p>
              <p className="text-lg font-bold text-green-900">{calculateArea().toFixed(2)} m²</p>
            </div>
            <div>
              <p className="text-xs text-green-700">Perímetro</p>
              <p className="text-lg font-bold text-green-900">{calculatePerimeter().toFixed(2)} m</p>
            </div>
          </div>
        </div>
      )}

      {vertices.length < 3 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            ⚠️ Se requieren al menos 3 vértices para formar un polígono válido
          </p>
        </div>
      )}
    </div>
  );

  const renderManualDrawing = () => (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">🗺️</div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">
        Dibujo Manual
      </h3>
      <p className="text-gray-600 mb-6">
        Esta función se implementará en la siguiente fase con integración de mapa interactivo
      </p>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
        <p className="text-sm text-blue-800">
          💡 Por ahora, puedes usar el método de "Ingresar Coordenadas" para continuar
        </p>
      </div>
    </div>
  );

  const renderImportFile = () => (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">📁</div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">
        Importar Archivo
      </h3>
      <p className="text-gray-600 mb-6">
        Esta función se implementará en la FASE 4
      </p>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
        <p className="text-sm text-blue-800">
          💡 Por ahora, puedes usar el método de "Ingresar Coordenadas" para continuar
        </p>
      </div>
    </div>
  );

  const renderTemplateSelection = () => (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">📋</div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">
        Usar Plantilla
      </h3>
      <p className="text-gray-600 mb-6">
        Esta función se implementará en la FASE 4
      </p>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
        <p className="text-sm text-blue-800">
          💡 Por ahora, puedes usar el método de "Ingresar Coordenadas" para continuar
        </p>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      {renderMethodSpecificContent()}
    </div>
  );
}
