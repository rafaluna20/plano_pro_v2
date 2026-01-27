import { useEffect } from 'react';
import { useEditorStore } from '@/lib/editor/store';
import { DrawingTool } from '@/types/editor';

/**
 * Hook para manejar atajos de teclado del editor
 * Soporta Ctrl+Z (Undo), Ctrl+Y (Redo), V (Select), P (Polygon), etc.
 */
export function useKeyboardShortcuts() {
  const { 
    undo, 
    redo, 
    canUndo, 
    canRedo, 
    setActiveTool,
    toggleGrid,
    toggleSnap
  } = useEditorStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si estamos en un input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Undo/Redo
      if (modifier && e.key === 'z' && !e.shiftKey && canUndo()) {
        e.preventDefault();
        undo();
        return;
      }

      if ((modifier && e.shiftKey && e.key === 'z' || modifier && e.key === 'y') && canRedo()) {
        e.preventDefault();
        redo();
        return;
      }

      // Herramientas (solo si no hay modificador)
      if (!modifier && !e.shiftKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'v':
            e.preventDefault();
            setActiveTool(DrawingTool.SELECT);
            break;
          case 'h':
            e.preventDefault();
            setActiveTool(DrawingTool.PAN);
            break;
          case 'p':
            e.preventDefault();
            setActiveTool(DrawingTool.POLYGON);
            break;
          case 'm':
            e.preventDefault();
            setActiveTool(DrawingTool.MEASURE);
            break;
          case 'g':
            e.preventDefault();
            toggleGrid();
            break;
          case 's':
            e.preventDefault();
            toggleSnap();
            break;
          case 'escape':
            e.preventDefault();
            setActiveTool(DrawingTool.SELECT);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo, setActiveTool, toggleGrid, toggleSnap]);
}
