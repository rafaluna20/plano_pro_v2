'use client';

import { Dimensiones, LoteMetadata, Colindancia } from '@/types/planos';

interface PropertyPanelProps {
  lote: LoteMetadata;
  dimensiones: Dimensiones;
  colindancias: Colindancia[];
  onLoteChange?: (lote: LoteMetadata) => void;
  onColindanciasChange?: (colindancias: Colindancia[]) => void;
  editable?: boolean;
}

export function PropertyPanel({
  lote,
  dimensiones,
  colindancias,
  onLoteChange,
  onColindanciasChange,
  editable = false
}: PropertyPanelProps) {
  return (
    <div className="h-full overflow-y-auto bg-white border-l border-gray-200">
      <div className="p-6 space-y-6">
        {/* Información del Lote */}
        <section>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-blue-600 rounded"></span>
            Información del Lote
          </h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código
              </label>
              <input
                type="text"
                value={lote.codigo}
                onChange={(e) => onLoteChange?.({ ...lote, codigo: e.target.value })}
                disabled={!editable}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre
              </label>
              <input
                type="text"
                value={lote.nombre}
                onChange={(e) => onLoteChange?.({ ...lote, nombre: e.target.value })}
                disabled={!editable}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Etapa
                </label>
                <input
                  type="text"
                  value={lote.etapa}
                  onChange={(e) => onLoteChange?.({ ...lote, etapa: e.target.value })}
                  disabled={!editable}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Manzana
                </label>
                <input
                  type="text"
                  value={lote.manzana}
                  onChange={(e) => onLoteChange?.({ ...lote, manzana: e.target.value })}
                  disabled={!editable}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lote
                </label>
                <input
                  type="text"
                  value={lote.numeroLote}
                  onChange={(e) => onLoteChange?.({ ...lote, numeroLote: e.target.value })}
                  disabled={!editable}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={lote.estado}
                onChange={(e) => onLoteChange?.({ ...lote, estado: e.target.value as any })}
                disabled={!editable}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50"
              >
                <option value="libre">Libre</option>
                <option value="separado">Separado</option>
                <option value="vendido">Vendido</option>
              </select>
            </div>
          </div>
        </section>

        {/* Dimensiones */}
        <section>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-green-600 rounded"></span>
            Dimensiones
          </h3>
          
          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
            <p className="font-medium">ℹ️ Calculadas automáticamente</p>
            <p className="mt-1">Las dimensiones se calculan desde los vértices del mapa.</p>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm font-medium text-gray-700">Área Total</span>
              <span className="text-sm font-semibold">{dimensiones.area.toFixed(2)} m²</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm font-medium text-gray-700">Perímetro</span>
              <span className="text-sm font-semibold">{dimensiones.perimetro.toFixed(2)} m</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm font-medium text-gray-700">Frente</span>
              <span className="text-sm">{dimensiones.frente.toFixed(2)} m</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm font-medium text-gray-700">Fondo</span>
              <span className="text-sm">{dimensiones.fondo.toFixed(2)} m</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm font-medium text-gray-700">Lado Derecho</span>
              <span className="text-sm">{dimensiones.ladoDerecho.toFixed(2)} m</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-gray-700">Lado Izquierdo</span>
              <span className="text-sm">{dimensiones.ladoIzquierdo.toFixed(2)} m</span>
            </div>
          </div>
        </section>

        {/* Colindancias */}
        <section>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-orange-600 rounded"></span>
            Colindancias
          </h3>
          
          <div className="space-y-3">
            {colindancias.map((col, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-md border border-gray-200">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase">
                    {col.lado}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    col.tipo === 'lote' ? 'bg-blue-100 text-blue-700' :
                    col.tipo === 'calle' ? 'bg-green-100 text-green-700' :
                    col.tipo === 'area_verde' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>
                    {col.tipo.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900">{col.nombre}</p>
                {col.propietario && (
                  <p className="text-xs text-gray-600 mt-1">Prop: {col.propietario}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Leyenda de colores */}
        <section className="pt-4 border-t">
          <h4 className="text-sm font-semibold mb-3 text-gray-700">Leyenda</h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
              <span>Lote</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
              <span>Calle</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-100 border border-emerald-300 rounded"></div>
              <span>Área Verde</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded"></div>
              <span>Área Común</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
