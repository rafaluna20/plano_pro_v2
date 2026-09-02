'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, FileText, RefreshCw, AlertTriangle } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

interface PlanoDetalle {
  id: string;
  loteCodigo: string;
  loteNombre: string;
  manzana: string | null;
  etapa: string | null;
  numeroLote: string | null;
  vertices: unknown;
  dimensiones: { frente?: number; fondo?: number; ladoDerecho?: number; ladoIzquierdo?: number; area?: number; perimetro?: number } | null;
  colindancias: Array<{ lado: string; tipo: string; nombre: string }> | null;
  propietario: { nombre?: string } | null;
  pdfUrl?: string | null;
  pdfSize?: number | null;
  dxfUrl?: string | null;
  thumbnailUrl?: string | null;
  status: string;
  errorMessage?: string | null;
  source: string;
  generatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'COMPLETED': return 'bg-green-100 text-green-800';
    case 'PROCESSING': return 'bg-blue-100 text-blue-800';
    case 'PENDING': return 'bg-yellow-100 text-yellow-800';
    case 'FAILED': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getStatusText(status: string) {
  switch (status) {
    case 'COMPLETED': return 'Completado';
    case 'PROCESSING': return 'Procesando';
    case 'PENDING': return 'Pendiente';
    case 'FAILED': return 'Error';
    default: return status;
  }
}

export default function PlanoDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [plano, setPlano] = useState<PlanoDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlano = useCallback(async () => {
    const apiKey = localStorage.getItem('apiKey');
    if (!apiKey) {
      setError('No se encontró tu API key en este dispositivo. Ve al dashboard y usa "Conectar con la API".');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/v1/planos/${params.id}`, {
        headers: { 'x-api-key': apiKey }
      });
      const data = await response.json();

      if (data.success) {
        setPlano(data.data);
        setError(null);
      } else {
        setError(data.error?.message || 'No se pudo cargar el plano');
      }
    } catch (err) {
      console.error('Error obteniendo plano:', err);
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchPlano();
  }, [fetchPlano]);

  // Refresco automático mientras el job de generación sigue en cola
  // (el worker BullMQ actualiza el status de forma asíncrona).
  useEffect(() => {
    if (!plano || (plano.status !== 'PENDING' && plano.status !== 'PROCESSING')) return;
    const interval = setInterval(fetchPlano, 5000);
    return () => clearInterval(interval);
  }, [plano, fetchPlano]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
            <div>
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
              >
                <ArrowLeft size={16} /> Volver al dashboard
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                {plano ? plano.loteNombre : 'Detalle del Plano'}
              </h1>
            </div>
            {plano && (
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(plano.status)}`}>
                {getStatusText(plano.status)}
              </span>
            )}
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loading ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-sm text-gray-600">Cargando plano...</p>
            </div>
          ) : error ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <AlertTriangle className="mx-auto h-10 w-10 text-amber-500 mb-3" />
              <p className="text-sm text-gray-700">{error}</p>
              <button
                onClick={() => router.push('/dashboard')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm font-medium"
              >
                Ir al dashboard
              </button>
            </div>
          ) : plano ? (
            <div className="space-y-6">
              {(plano.status === 'PENDING' || plano.status === 'PROCESSING') && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                  <RefreshCw size={18} className="text-blue-600 animate-spin" />
                  <p className="text-sm text-blue-800">
                    El plano se está generando. Esta página se actualiza sola cada pocos segundos.
                  </p>
                </div>
              )}

              {plano.status === 'FAILED' && plano.errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-800 mb-1">La generación falló</p>
                  <p className="text-sm text-red-700">{plano.errorMessage}</p>
                </div>
              )}

              {plano.status === 'COMPLETED' && (plano.pdfUrl || plano.dxfUrl) && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Documentos</h2>
                  <div className="flex flex-wrap gap-3">
                    {plano.pdfUrl && (
                      <a
                        href={plano.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition text-sm font-medium"
                      >
                        <Download size={16} /> Descargar PDF
                      </a>
                    )}
                    {plano.dxfUrl && (
                      <a
                        href={plano.dxfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 transition text-sm font-medium"
                      >
                        <FileText size={16} /> Descargar DXF
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Datos del lote</h2>
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="text-gray-500">Código</dt>
                    <dd className="font-medium text-gray-900">{plano.loteCodigo}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Manzana</dt>
                    <dd className="font-medium text-gray-900">{plano.manzana || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Etapa</dt>
                    <dd className="font-medium text-gray-900">{plano.etapa || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Número de lote</dt>
                    <dd className="font-medium text-gray-900">{plano.numeroLote || '—'}</dd>
                  </div>
                  {plano.propietario?.nombre && (
                    <div>
                      <dt className="text-gray-500">Propietario</dt>
                      <dd className="font-medium text-gray-900">{plano.propietario.nombre}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-gray-500">Origen</dt>
                    <dd className="font-medium text-gray-900">{plano.source}</dd>
                  </div>
                </dl>
              </div>

              {plano.dimensiones && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Dimensiones</h2>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <dt className="text-gray-500">Frente</dt>
                      <dd className="font-medium text-gray-900">{plano.dimensiones.frente?.toFixed(2) ?? '—'} m</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Fondo</dt>
                      <dd className="font-medium text-gray-900">{plano.dimensiones.fondo?.toFixed(2) ?? '—'} m</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Lado derecho</dt>
                      <dd className="font-medium text-gray-900">{plano.dimensiones.ladoDerecho?.toFixed(2) ?? '—'} m</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Lado izquierdo</dt>
                      <dd className="font-medium text-gray-900">{plano.dimensiones.ladoIzquierdo?.toFixed(2) ?? '—'} m</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Área</dt>
                      <dd className="font-medium text-gray-900">{plano.dimensiones.area?.toFixed(2) ?? '—'} m²</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Perímetro</dt>
                      <dd className="font-medium text-gray-900">{plano.dimensiones.perimetro?.toFixed(2) ?? '—'} m</dd>
                    </div>
                  </dl>
                </div>
              )}

              {plano.colindancias && plano.colindancias.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Colindancias</h2>
                  <ul className="divide-y divide-gray-200 text-sm">
                    {plano.colindancias.map((c, i) => (
                      <li key={i} className="py-2 flex justify-between">
                        <span className="text-gray-500 capitalize">{c.lado?.toLowerCase()}</span>
                        <span className="font-medium text-gray-900">{c.nombre} ({c.tipo})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center">
                Creado el {new Date(plano.createdAt).toLocaleString('es-PE')}
                {plano.generatedAt && ` · Generado el ${new Date(plano.generatedAt).toLocaleString('es-PE')}`}
              </p>
            </div>
          ) : null}
        </main>
      </div>
    </ProtectedRoute>
  );
}
