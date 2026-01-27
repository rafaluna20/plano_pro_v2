'use client';

import { EditorMode } from '@/types/editor';
import { useEditorStore } from '@/lib/editor/store';
import { Wand2, Pencil, FileCode, Upload } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ModeOption {
  mode: EditorMode;
  label: string;
  icon: typeof Wand2;
  color: string;
  description: string;
}

const modeOptions: ModeOption[] = [
  {
    mode: EditorMode.WIZARD,
    label: 'Wizard',
    icon: Wand2,
    color: 'from-blue-500 to-indigo-600',
    description: 'Guía paso a paso'
  },
  {
    mode: EditorMode.FREEFORM,
    label: 'Libre',
    icon: Pencil,
    color: 'from-green-500 to-emerald-600',
    description: 'Dibujo libre CAD'
  },
  {
    mode: EditorMode.TEMPLATE,
    label: 'Plantilla',
    icon: FileCode,
    color: 'from-purple-500 to-violet-600',
    description: 'Desde plantilla'
  },
  {
    mode: EditorMode.IMPORT,
    label: 'Importar',
    icon: Upload,
    color: 'from-orange-500 to-amber-600',
    description: 'Importar datos'
  }
];

export function ModeSwitcher() {
  const { mode, setMode, vertices, history } = useEditorStore();

  const handleModeChange = (newMode: EditorMode) => {
    // Verificar si hay cambios sin guardar
    const hasUnsavedWork = vertices.length > 0 || history.past.length > 0;

    if (hasUnsavedWork && mode !== newMode) {
      const confirmed = window.confirm(
        '⚠️ Tienes trabajo sin guardar.\n\n' +
        `¿Deseas cambiar de "${getModeLabel(mode)}" a "${getModeLabel(newMode)}"?\n\n` +
        'Esto podría descartar tus cambios actuales.'
      );

      if (!confirmed) {
        return;
      }
    }

    setMode(newMode);
    toast.success(`Modo cambiado a: ${getModeLabel(newMode)}`, {
      icon: getIconEmoji(newMode),
      duration: 2000
    });
  };

  const getModeLabel = (m: EditorMode): string => {
    return modeOptions.find(opt => opt.mode === m)?.label || m;
  };

  const getIconEmoji = (m: EditorMode): string => {
    const icons = {
      [EditorMode.WIZARD]: '🪄',
      [EditorMode.FREEFORM]: '✏️',
      [EditorMode.TEMPLATE]: '📐',
      [EditorMode.IMPORT]: '📥'
    };
    return icons[m] || '✨';
  };

  return (
    <div className="pointer-events-auto inline-flex items-center bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-gray-200 p-1.5 gap-1">
      {modeOptions.map((option) => {
        const Icon = option.icon;
        const isActive = mode === option.mode;

        return (
          <button
            key={option.mode}
            onClick={() => handleModeChange(option.mode)}
            title={option.description}
            className={`
              group relative flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm
              transition-all duration-300 ease-out
              ${isActive 
                ? `bg-gradient-to-r ${option.color} text-white shadow-md scale-105` 
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }
            `}
          >
            {/* Icono */}
            <Icon 
              className={`w-4 h-4 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} 
            />
            
            {/* Label (solo visible en modo activo) */}
            <span className={`
              font-semibold tracking-tight
              transition-all duration-200
              ${isActive ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'}
            `}>
              {option.label}
            </span>

            {/* Tooltip para modos inactivos */}
            {!isActive && (
              <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {option.description}
              </span>
            )}

            {/* Indicador de modo activo */}
            {isActive && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full shadow-sm" />
            )}
          </button>
        );
      })}
    </div>
  );
}
