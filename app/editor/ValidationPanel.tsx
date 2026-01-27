'use client';

import { useMemo } from 'react';
import { UTMCoordinate } from '@/types/planos';
import { useGeometry, usePolygonValidation } from '@/lib/hooks/useGeometry';
import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface ValidationPanelProps {
  vertices: UTMCoordinate[];
  lote: any;
}

interface ValidationMessage {
  type: 'error' | 'warning' | 'info' | 'success';
  message: string;
  field?: string;
}

export function ValidationPanel({ vertices, lote }: ValidationPanelProps) {
  const geometry = useGeometry(vertices);
  const polygonValidation = usePolygonValidation(vertices);

  // Validaciones en tiempo real
  const validations = useMemo((): ValidationMessage[] => {
    const messages: ValidationMessage[] = [];

    // Validación de vértices
    if (vertices.length === 0) {
      messages.push({
        type: 'info',
        message: 'Comienza a dibujar tu polígono haciendo clic en el canvas',
      });
    } else if (vertices.length < 3) {
      messages.push({
        type: 'warning',
        message: `Se requieren al menos 3 vértices. Actual: ${vertices.length}`,
        field: 'vertices'
      });
    } else if (vertices.length >= 3) {
      messages.push({
        type: 'success',
        message: `Polígono válido con ${vertices.length} vértices`,
        field: 'vertices'
      });
    }

    // Validación del polígono
    if (!polygonValidation.isValid && polygonValidation.error) {
      messages.push({
        type: 'error',
        message: polygonValidation.error,
        field: 'geometry'
      });
    }

    // Validación de área
    if (vertices.length >= 3) {
      if (geometry.area < 50) {
        messages.push({
          type: 'warning',
          message: 'El área es muy pequeña (< 50 m²). Verifica las coordenadas.',
          field: 'area'
        });
      } else if (geometry.area > 10000) {
        messages.push({
          type: 'warning',
          message: 'El área es muy grande (> 10,000 m²). Verifica las coordenadas.',
          field: 'area'
        });
      } else {
        messages.push({
          type: 'success',
          message: `Área calculada: ${geometry.area.toFixed(2)} m²`,
          field: 'area'
        });
      }

      // Validación de perímetro
      if (geometry.perimetro < 20) {
        messages.push({
          type: 'warning',
          message: 'El perímetro es muy pequeño. Verifica las medidas.',
          field: 'perimeter'
        });
      } else {
        messages.push({
          type: 'success',
          message: `Perímetro: ${geometry.perimetro.toFixed(2)} m`,
          field: 'perimeter'
        });
      }
    }

    // Validación de datos del lote
    if (!lote.codigo || lote.codigo === '') {
      messages.push({
        type: 'error',
        message: 'El código del lote es obligatorio',
        field: 'codigo'
      });
    }

    if (!lote.nombre || lote.nombre === '') {
      messages.push({
        type: 'error',
        message: 'El nombre del lote es obligatorio',
        field: 'nombre'
      });
    }

    if (!lote.manzana || lote.manzana === '') {
      messages.push({
        type: 'warning',
        message: 'Se recomienda especificar la manzana',
        field: 'manzana'
      });
    }

    // Validaciones de forma del polígono
    if (vertices.length >= 4) {
      // Verificar si es aproximadamente rectangular
      const sides = [
        geometry.frente,
        geometry.ladoDerecho,
        geometry.fondo,
        geometry.ladoIzquierdo
      ];
      
      const parallelSides1 = Math.abs(sides[0] - sides[2]) / Math.max(sides[0], sides[2]);
      const parallelSides2 = Math.abs(sides[1] - sides[3]) / Math.max(sides[1], sides[3]);
      
      if (parallelSides1 < 0.05 && parallelSides2 < 0.05) {
        messages.push({
          type: 'info',
          message: 'El lote tiene forma rectangular',
          field: 'shape'
        });
      } else {
        messages.push({
          type: 'info',
          message: 'El lote tiene forma irregular',
          field: 'shape'
        });
      }
    }

    return messages;
  }, [vertices, geometry, polygonValidation, lote]);

  // Contar por tipo
  const counts = useMemo(() => ({
    error: validations.filter(v => v.type === 'error').length,
    warning: validations.filter(v => v.type === 'warning').length,
    info: validations.filter(v => v.type === 'info').length,
    success: validations.filter(v => v.type === 'success').length,
  }), [validations]);

  const getIcon = (type: ValidationMessage['type']) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    }
  };

  const getBackgroundColor = (type: ValidationMessage['type']) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-amber-50 border-amber-200';
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
    }
  };

  const canExport = counts.error === 0 && vertices.length >= 3;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Validación en Tiempo Real
          </h3>
          <div className="flex items-center gap-2 text-xs">
            {counts.error > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                {counts.error} errores
              </span>
            )}
            {counts.warning > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                {counts.warning} advertencias
              </span>
            )}
            {canExport && (
              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                ✓ Listo para exportar
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Validations List */}
      <div className="p-4 space-y-2 max-h-60 overflow-y-auto">
        {validations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No hay validaciones disponibles
          </div>
        ) : (
          validations.map((validation, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 p-3 rounded-lg border ${getBackgroundColor(validation.type)} transition-all duration-200`}
            >
              {getIcon(validation.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{validation.message}</p>
                {validation.field && (
                  <p className="text-xs text-gray-500 mt-1">Campo: {validation.field}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary Footer */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>Estado del proyecto:</span>
          {canExport ? (
            <span className="flex items-center gap-1 text-green-600 font-medium">
              <CheckCircle className="w-3 h-3" />
              Todo correcto
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-600 font-medium">
              <AlertTriangle className="w-3 h-3" />
              Requiere atención
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
