'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Eye, Download, FileText } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

interface Plano {
  id: string;
  loteCodigo: string;
  loteNombre: string;
  status: string;
  pdfUrl?: string;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    failed: 0
  });

  useEffect(() => {
    fetchPlanos();
  }, []);

  const fetchPlanos = async () => {
    try {
      const apiKey = localStorage.getItem('apiKey');

      // Si no hay API key, usar datos de ejemplo (modo demo)
      if (!apiKey) {
        const planosEjemplo: Plano[] = [
          {
            id: 'demo-1',
            loteCodigo: 'E02MZT011',
            loteNombre: 'Etapa 02 Mz T Lote 11',
            status: 'COMPLETED',
            pdfUrl: '#',
            createdAt: new Date().toISOString()
          },
          {
            id: 'demo-2',
            loteCodigo: 'E01MZA005',
            loteNombre: 'Etapa 01 Mz A Lote 05',
            status: 'PENDING',
            createdAt: new Date(Date.now() - 86400000).toISOString()
          }
        ];

        setPlanos(planosEjemplo);
        setStats({
          total: 2,
          completed: 1,
          pending: 1,
          failed: 0
        });
        setLoading(false);
        return;
      }

      const response = await fetch('/api/v1/planos/lista?pageSize=10', {
        headers: {
          'x-api-key': apiKey
        }
      });

      const data = await response.json();

      if (data.success) {
        setPlanos(data.data);

        // Calcular stats
        const completed = data.data.filter((p: Plano) => p.status === 'COMPLETED').length;
        const pending = data.data.filter((p: Plano) => p.status === 'PENDING' || p.status === 'PROCESSING').length;
        const failed = data.data.filter((p: Plano) => p.status === 'FAILED').length;

        setStats({
          total: data.metadata?.total || data.data.length,
          completed,
          pending,
          failed
        });
      }
    } catch (error) {
      console.error('Error fetching planos:', error);
      // En caso de error, mostrar datos de ejemplo
      setPlanos([]);
      setStats({ total: 0, completed: 0, pending: 0, failed: 0 });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'Completado';
      case 'PROCESSING':
        return 'Procesando';
      case 'PENDING':
        return 'Pendiente';
      case 'FAILED':
        return 'Error';
      default:
        return status;
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Planos Pro</h1>
                <p className="mt-1 text-sm text-gray-600">Sistema de generación de planos técnicos</p>
              </div>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium"
              >
                + Nuevo Plano
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Planos</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Completados</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pendientes</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Con Error</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.failed}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Planos List */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Planos Recientes</h2>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-sm text-gray-600">Cargando planos...</p>
              </div>
            ) : planos.length === 0 ? (
              <div className="p-12 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mt-2 text-sm text-gray-600">No hay planos generados aún</p>
                <button
                  onClick={() => router.push('/')}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm font-medium"
                >
                  Crear primer plano
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Código
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nombre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {planos.map((plano) => (
                      <tr key={plano.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {plano.loteCodigo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {plano.loteNombre}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(plano.status)}`}>
                            {getStatusText(plano.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(plano.createdAt).toLocaleString('es-PE')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-3">
                            <button
                              onClick={() => router.push(`/editor/${plano.id}`)}
                              className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                              title="Ver editor"
                            >
                              <Eye size={16} /> Ver
                            </button>

                            {plano.pdfUrl && (
                              <a
                                href={plano.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-900 flex items-center gap-1"
                                title="Descargar PDF"
                              >
                                <Download size={16} /> PDF
                              </a>
                            )}

                            <button
                              onClick={async () => {
                                if (!confirm('¿Estás seguro de eliminar este plano permanentemente?')) return;
                                
                                try {
                                  // Eliminación real en la base de datos
                                  const apiKey = localStorage.getItem('apiKey');
                                  if (!apiKey) {
                                    // Modo demo: Solo eliminar de la lista local
                                    setPlanos(prev => prev.filter(p => p.id !== plano.id));
                                    return;
                                  }

                                  const response = await fetch(`/api/v1/planos/${plano.id}`, {
                                    method: 'DELETE',
                                    headers: {
                                      'x-api-key': apiKey
                                    }
                                  });

                                  if (response.ok) {
                                    // Actualizar estado local eliminando el item
                                    setPlanos(prev => prev.filter(p => p.id !== plano.id));
                                    // Actualizar contadores
                                    setStats(prev => ({
                                      ...prev,
                                      total: prev.total - 1,
                                      completed: plano.status === 'COMPLETED' ? prev.completed - 1 : prev.completed,
                                      pending: (plano.status === 'PENDING' || plano.status === 'PROCESSING') ? prev.pending - 1 : prev.pending,
                                      failed: plano.status === 'FAILED' ? prev.failed - 1 : prev.failed
                                    }));
                                  } else {
                                    alert('Error al eliminar el plano. Por favor intenta nuevamente.');
                                  }
                                } catch (error) {
                                  console.error('Error eliminando plano:', error);
                                  alert('Ocurrió un error al intentar eliminar el plano.');
                                }
                              }}
                              className="text-red-600 hover:text-red-900 flex items-center gap-1"
                              title="Eliminar plano"
                            >
                              <Trash2 size={16} /> Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
