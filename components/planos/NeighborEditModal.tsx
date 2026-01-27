'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, MapPin } from 'lucide-react';

interface Vertice {
    id: string;
    x: number;
    y: number;
}

interface LoteVecino {
    id: string;
    nombre: string;
    vertices: Vertice[];
    codigo?: string;
    estado?: string;
}

interface NeighborEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    neighbor: LoteVecino | null;
    onSave: (updatedNeighbor: LoteVecino) => void;
    onDelete: (neighborId: string) => void;
}

export function NeighborEditModal({ isOpen, onClose, neighbor, onSave, onDelete }: NeighborEditModalProps) {
    const [editedNeighbor, setEditedNeighbor] = useState<LoteVecino | null>(null);

    useEffect(() => {
        if (neighbor) {
            setEditedNeighbor(JSON.parse(JSON.stringify(neighbor))); // Deep clone
        } else {
            setEditedNeighbor(null);
        }
    }, [neighbor]);

    if (!isOpen || !editedNeighbor) return null;

    const handleVertexChange = (index: number, field: keyof Vertice, value: string) => {
        if (!editedNeighbor) return;
        const newVertices = [...editedNeighbor.vertices];
        newVertices[index] = {
            ...newVertices[index],
            [field]: field === 'id' ? value : parseFloat(value) || 0
        };
        setEditedNeighbor({ ...editedNeighbor, vertices: newVertices });
    };

    const addVertex = () => {
        if (!editedNeighbor) return;
        const lastV = editedNeighbor.vertices[editedNeighbor.vertices.length - 1];
        const newId = (editedNeighbor.vertices.length + 1).toString();
        const newVertex = { id: newId, x: (lastV?.x || 0) + 5, y: (lastV?.y || 0) };
        setEditedNeighbor({ ...editedNeighbor, vertices: [...editedNeighbor.vertices, newVertex] });
    };

    const removeVertex = (index: number) => {
        if (!editedNeighbor || editedNeighbor.vertices.length <= 3) return;
        const newVertices = editedNeighbor.vertices.filter((_, i) => i !== index);
        setEditedNeighbor({ ...editedNeighbor, vertices: newVertices });
    };

    const handleInfoChange = (field: keyof LoteVecino, value: string) => {
        if (!editedNeighbor) return;
        setEditedNeighbor({ ...editedNeighbor, [field]: value });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-800">
                            <MapPin size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900">Editar Lote Vecino</h3>
                            <p className="text-sm text-slate-500">Ajusta los vértices y la información del colindante</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Identificación */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre</label>
                            <input
                                type="text"
                                value={editedNeighbor.nombre}
                                onChange={(e) => handleInfoChange('nombre', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-800"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Código</label>
                            <input
                                type="text"
                                value={editedNeighbor.codigo || ''}
                                onChange={(e) => handleInfoChange('codigo', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-800"
                            />
                        </div>
                    </div>

                    {/* Vértices */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vértices (Coordenadas UTM)</h4>
                            <button
                                onClick={addVertex}
                                className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded hover:bg-emerald-100 transition-colors"
                            >
                                <Plus size={14} /> Añadir Vértice
                            </button>
                        </div>

                        <div className="space-y-2">
                            {editedNeighbor.vertices.map((vertice, index) => (
                                <div key={index} className="flex gap-2 items-center p-2 rounded border bg-slate-50 border-slate-200">
                                    <input
                                        type="text"
                                        value={vertice.id}
                                        onChange={(e) => handleVertexChange(index, 'id', e.target.value)}
                                        className="w-8 h-6 flex items-center justify-center bg-white rounded border border-slate-200 text-[10px] font-bold shrink-0 shadow-sm outline-none text-center focus:border-blue-500"
                                    />
                                    <div className="flex-1 grid grid-cols-2 gap-2">
                                        <div className="relative">
                                            <span className="absolute left-1.5 top-1 text-[9px] font-bold text-slate-400">E</span>
                                            <input
                                                type="number"
                                                value={vertice.x}
                                                onChange={(e) => handleVertexChange(index, 'x', e.target.value)}
                                                className="w-full pl-4 pr-1 py-1 text-xs bg-white border border-slate-200 rounded focus:border-blue-800 focus:outline-none"
                                            />
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-1.5 top-1 text-[9px] font-bold text-slate-400">N</span>
                                            <input
                                                type="number"
                                                value={vertice.y}
                                                onChange={(e) => handleVertexChange(index, 'y', e.target.value)}
                                                className="w-full pl-4 pr-1 py-1 text-xs bg-white border border-slate-200 rounded focus:border-blue-800 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeVertex(index)}
                                        className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                        disabled={editedNeighbor.vertices.length <= 3}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between gap-3">
                    <button
                        onClick={() => {
                            if (confirm('¿Estás seguro de eliminar este lote colindante?')) {
                                onDelete(editedNeighbor.id);
                                onClose();
                            }
                        }}
                        className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Trash2 size={16} /> Eliminar Lote
                    </button>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => onSave(editedNeighbor)}
                            className="px-6 py-2 bg-blue-800 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-900 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <Save size={16} /> Guardar Cambios
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
