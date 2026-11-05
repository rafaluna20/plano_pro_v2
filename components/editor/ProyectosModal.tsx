"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Copy, FolderOpen, Loader2, Search, Trash2, X } from "lucide-react";
import {
  duplicarProyecto,
  eliminarProyecto,
  listarProyectos,
  type ProyectoEnLista,
} from "@/lib/editor/proyectosApi";

interface ProyectosModalProps {
  open: boolean;
  actualId: string | null;
  onClose: () => void;
  onAbrir: (id: string) => void;
  /** Se avisa al eliminar para que el editor suelte el proyecto si era el abierto. */
  onEliminado: (id: string) => void;
}

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function ProyectosModal({ open, actualId, onClose, onAbrir, onEliminado }: ProyectosModalProps) {
  const [proyectos, setProyectos] = useState<ProyectoEnLista[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null);

  const cargar = async () => {
    setError(null);
    try {
      setProyectos(await listarProyectos());
    } catch (e) {
      setProyectos([]);
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    if (!open) return;
    setProyectos(null);
    setBusqueda("");
    setConfirmandoEliminar(null);
    void cargar();
  }, [open]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q || !proyectos) return proyectos ?? [];
    return proyectos.filter((p) =>
      [p.nombre, p.resumen?.loteId, p.resumen?.propietario, p.resumen?.distrito]
        .filter(Boolean)
        .some((t) => String(t).toLowerCase().includes(q)),
    );
  }, [proyectos, busqueda]);

  if (!open) return null;

  const duplicar = async (id: string) => {
    setOcupado(id);
    setError(null);
    try {
      await duplicarProyecto(id);
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(null);
    }
  };

  const eliminar = async (id: string) => {
    setOcupado(id);
    setError(null);
    try {
      await eliminarProyecto(id);
      setConfirmandoEliminar(null);
      onEliminado(id);
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Mis proyectos"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FolderOpen size={20} className="text-blue-800" /> Mis proyectos
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, código, propietario o distrito"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && <div className="mx-5 mt-3 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {proyectos === null ? (
            <div className="py-10 flex justify-center text-slate-400">
              <Loader2 className="animate-spin" />
            </div>
          ) : visibles.length === 0 ? (
            error ? null : <p className="py-10 text-center text-sm text-slate-500">
              {proyectos.length === 0 ? "Aún no guardaste ningún proyecto. Usa «Guardar» en el editor." : "Ningún proyecto coincide con la búsqueda."}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visibles.map((p) => {
                const r = p.resumen;
                const detalle = [r?.loteId, r?.propietario, r?.distrito, r ? `${r.vertices} vértices` : null, r && r.vecinos ? `${r.vecinos} vecinos` : null]
                  .filter(Boolean)
                  .join(" · ");
                const enUso = p.id === actualId;
                return (
                  <li key={p.id} className="py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {p.nombre} {enUso && <span className="ml-1 text-[11px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">abierto</span>}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{detalle || "Sin datos"}</div>
                      <div className="text-[11px] text-slate-400">Modificado {fechaCorta(p.updatedAt)}</div>
                    </div>
                    {confirmandoEliminar === p.id ? (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-red-700">¿Eliminar?</span>
                        <button
                          onClick={() => eliminar(p.id)}
                          disabled={ocupado === p.id}
                          className="px-2.5 py-1 text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-60"
                        >
                          Sí, eliminar
                        </button>
                        <button onClick={() => setConfirmandoEliminar(null)} className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded">
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onAbrir(p.id)}
                          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-800 hover:bg-blue-900 rounded-lg"
                        >
                          Abrir
                        </button>
                        <button
                          onClick={() => duplicar(p.id)}
                          disabled={ocupado === p.id}
                          title="Duplicar: copia este proyecto para reutilizar sus datos"
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-60"
                        >
                          {ocupado === p.id ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                        </button>
                        <button
                          onClick={() => setConfirmandoEliminar(p.id)}
                          title="Eliminar"
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

interface GuardarComoProps {
  open: boolean;
  nombreInicial: string;
  guardando: boolean;
  titulo?: string;
  onGuardar: (nombre: string) => void;
  onCancelar: () => void;
}

/** Pide el nombre del proyecto (sin window.prompt, que bloquea la página). */
export function GuardarProyectoDialog(props: GuardarComoProps) {
  // Al montarse (cada vez que se abre) el campo arranca con el nombre propuesto.
  return props.open ? <FormularioGuardar {...props} /> : null;
}

function FormularioGuardar({ nombreInicial, guardando, titulo = "Guardar proyecto", onGuardar, onCancelar }: GuardarComoProps) {
  const [nombre, setNombre] = useState(nombreInicial);
  const valido = nombre.trim().length > 0 && nombre.trim().length <= 120;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancelar}>
      <form
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (valido && !guardando) onGuardar(nombre.trim());
        }}
      >
        <h2 className="text-lg font-bold text-slate-900 mb-3">{titulo}</h2>
        <label className="block text-sm text-slate-600 mb-1" htmlFor="nombre-proyecto">
          Nombre del proyecto
        </label>
        <input
          id="nombre-proyecto"
          autoFocus
          value={nombre}
          maxLength={120}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancelar} className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!valido || guardando}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-800 hover:bg-blue-900 rounded-lg disabled:opacity-60 flex items-center gap-2"
          >
            {guardando && <Loader2 size={14} className="animate-spin" />} Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
