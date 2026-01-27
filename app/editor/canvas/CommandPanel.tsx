'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useEditorStore } from '@/lib/editor/store';
import { DrawingTool } from '@/types/editor';
import toast from 'react-hot-toast';
import { Terminal, ChevronRight, History, HelpCircle } from 'lucide-react';

interface Command {
  name: string;
  aliases: string[];
  description: string;
  execute: (args: string[]) => void;
  syntax?: string;
}

export function CommandPanel() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<Command[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [output, setOutput] = useState<Array<{ text: string; type: 'command' | 'response' | 'error' }>>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  
  const { setActiveTool, addVertex, setMode, undo, redo } = useEditorStore();

  // Definición de comandos disponibles
  const commands: Command[] = [
    {
      name: 'line',
      aliases: ['l', 'ln'],
      description: 'Crea una línea entre dos puntos',
      syntax: 'L [x1,y1] [x2,y2]',
      execute: (args) => {
        setActiveTool(DrawingTool.LINE);
        if (args.length >= 2) {
          const coords1 = parseCoordinates(args[0]);
          const coords2 = parseCoordinates(args[1]);
          if (coords1 && coords2) {
            addVertex(coords1);
            addVertex(coords2);
            addOutput(`Línea creada: ${args[0]} → ${args[1]}`, 'response');
          } else {
            addOutput('Coordenadas inválidas. Formato: x,y', 'error');
          }
        } else {
          addOutput('Herramienta LÍNEA activada. Click en canvas para dibujar', 'response');
        }
      }
    },
    {
      name: 'polygon',
      aliases: ['pol', 'p', 'pl'],
      description: 'Crea un polígono',
      syntax: 'POL',
      execute: () => {
        setActiveTool(DrawingTool.POLYGON);
        addOutput('Herramienta POLÍGONO activada', 'response');
      }
    },
    {
      name: 'rectangle',
      aliases: ['rec', 'rect'],
      description: 'Crea un rectángulo',
      syntax: 'REC [x1,y1] [x2,y2]',
      execute: (args) => {
        setActiveTool(DrawingTool.RECTANGLE);
        addOutput('Herramienta RECTÁNGULO activada', 'response');
      }
    },
    {
      name: 'circle',
      aliases: ['c', 'cir'],
      description: 'Crea un círculo',
      syntax: 'C [centro_x,centro_y] [radio]',
      execute: () => {
        setActiveTool(DrawingTool.CIRCLE);
        addOutput('Herramienta CÍRCULO activada', 'response');
      }
    },
    {
      name: 'select',
      aliases: ['s', 'sel'],
      description: 'Activa herramienta de selección',
      syntax: 'S',
      execute: () => {
        setActiveTool(DrawingTool.SELECT);
        addOutput('Herramienta SELECCIÓN activada', 'response');
      }
    },
    {
      name: 'pan',
      aliases: ['p'],
      description: 'Activa herramienta de desplazamiento',
      syntax: 'PAN',
      execute: () => {
        setActiveTool(DrawingTool.PAN);
        addOutput('Herramienta PAN activada', 'response');
      }
    },
    {
      name: 'zoom',
      aliases: ['z'],
      description: 'Controla el zoom',
      syntax: 'Z [extents|window|previous]',
      execute: (args) => {
        if (args[0] === 'e' || args[0] === 'extents') {
          addOutput('Zoom a extensión completa', 'response');
        } else if (args[0] === 'w' || args[0] === 'window') {
          addOutput('Zoom por ventana - selecciona área', 'response');
        } else if (args[0] === 'p' || args[0] === 'previous') {
          addOutput('Zoom anterior', 'response');
        } else {
          setActiveTool(DrawingTool.ZOOM);
          addOutput('Herramienta ZOOM activada', 'response');
        }
      }
    },
    {
      name: 'undo',
      aliases: ['u'],
      description: 'Deshacer última acción',
      syntax: 'U',
      execute: () => {
        undo();
        addOutput('Deshacer', 'response');
      }
    },
    {
      name: 'redo',
      aliases: ['r'],
      description: 'Rehacer acción',
      syntax: 'REDO',
      execute: () => {
        redo();
        addOutput('Rehacer', 'response');
      }
    },
    {
      name: 'help',
      aliases: ['h', '?'],
      description: 'Muestra ayuda de comandos',
      syntax: 'HELP [comando]',
      execute: (args) => {
        if (args.length > 0) {
          const cmd = findCommand(args[0]);
          if (cmd) {
            addOutput(`${cmd.name.toUpperCase()}: ${cmd.description}`, 'response');
            addOutput(`Sintaxis: ${cmd.syntax || cmd.name.toUpperCase()}`, 'response');
            addOutput(`Alias: ${cmd.aliases.join(', ')}`, 'response');
          } else {
            addOutput(`Comando no encontrado: ${args[0]}`, 'error');
          }
        } else {
          addOutput('Comandos disponibles:', 'response');
          commands.forEach(cmd => {
            addOutput(`  ${cmd.name.toUpperCase().padEnd(12)} - ${cmd.description}`, 'response');
          });
          addOutput('Escribe HELP [comando] para más información', 'response');
        }
      }
    },
    {
      name: 'clear',
      aliases: ['cls'],
      description: 'Limpia el panel de comandos',
      syntax: 'CLEAR',
      execute: () => {
        setOutput([]);
      }
    },
  ];

  // Buscar comando por nombre o alias
  const findCommand = (input: string): Command | undefined => {
    const normalized = input.toLowerCase().trim();
    return commands.find(cmd => 
      cmd.name === normalized || cmd.aliases.includes(normalized)
    );
  };

  // Parsear coordenadas del formato "x,y"
  const parseCoordinates = (str: string): [number, number] | null => {
    const parts = str.split(',').map(p => parseFloat(p.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return [parts[0], parts[1]];
    }
    return null;
  };

  // Agregar salida al panel
  const addOutput = (text: string, type: 'command' | 'response' | 'error' = 'response') => {
    setOutput(prev => [...prev, { text, type }]);
    
    // Auto-scroll al final
    setTimeout(() => {
      if (outputRef.current) {
        outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }
    }, 10);
  };

  // Ejecutar comando
  const executeCommand = (commandStr: string) => {
    if (!commandStr.trim()) return;

    // Agregar al historial
    setHistory(prev => [...prev, commandStr]);
    setHistoryIndex(-1);

    // Mostrar comando en output
    addOutput(commandStr, 'command');

    // Parsear comando y argumentos
    const parts = commandStr.trim().split(/\s+/);
    const cmdName = parts[0];
    const args = parts.slice(1);

    // Buscar y ejecutar comando
    const cmd = findCommand(cmdName);
    if (cmd) {
      try {
        cmd.execute(args);
      } catch (error) {
        addOutput(`Error ejecutando comando: ${error}`, 'error');
      }
    } else {
      addOutput(`Comando no reconocido: ${cmdName}. Escribe HELP para ver comandos disponibles.`, 'error');
    }

    // Limpiar input
    setInput('');
    setSuggestions([]);
  };

  // Manejar cambio de input
  const handleInputChange = (value: string) => {
    setInput(value);

    // Generar sugerencias
    if (value.trim()) {
      const normalized = value.toLowerCase().trim();
      const matches = commands.filter(cmd =>
        cmd.name.startsWith(normalized) ||
        cmd.aliases.some(alias => alias.startsWith(normalized))
      );
      setSuggestions(matches.slice(0, 5));
      setSelectedSuggestion(0);
    } else {
      setSuggestions([]);
    }
  };

  // Manejar teclas especiales
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter: ejecutar comando
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0 && selectedSuggestion >= 0) {
        // Autocompletar con sugerencia seleccionada
        setInput(suggestions[selectedSuggestion].name + ' ');
        setSuggestions([]);
        inputRef.current?.focus();
      } else {
        executeCommand(input);
      }
    }
    
    // Tab: autocompletar primera sugerencia
    else if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setInput(suggestions[0].name + ' ');
        setSuggestions([]);
      }
    }
    
    // Flecha arriba: historial anterior
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setSelectedSuggestion(prev => Math.max(0, prev - 1));
      } else if (history.length > 0) {
        const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    }
    
    // Flecha abajo: historial siguiente
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setSelectedSuggestion(prev => Math.min(suggestions.length - 1, prev + 1));
      } else if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= history.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIndex);
          setInput(history[newIndex]);
        }
      }
    }
    
    // Escape: limpiar
    else if (e.key === 'Escape') {
      setInput('');
      setSuggestions([]);
      setSelectedSuggestion(0);
    }
  };

  // Atajo global para activar panel: "/"
  useEffect(() => {
    const handleGlobalKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  return (
    <div className="flex flex-col bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-sm transition-colors">
      {/* Output Area (expandible) */}
      {isExpanded && (
        <div
          ref={outputRef}
          className="max-h-64 overflow-y-auto p-2 space-y-1 bg-slate-50 dark:bg-slate-950 transition-colors"
        >
          {output.length === 0 ? (
            <div className="text-slate-500 dark:text-slate-500 text-xs italic">
              Escribe un comando y presiona Enter. Usa HELP para ver comandos disponibles.
            </div>
          ) : (
            output.map((line, i) => (
              <div
                key={i}
                className={`text-xs ${
                  line.type === 'command' ? 'text-cyan-600 dark:text-cyan-400 font-semibold' :
                  line.type === 'error' ? 'text-red-600 dark:text-red-400' :
                  'text-slate-700 dark:text-slate-300'
                }`}
              >
                {line.type === 'command' && <ChevronRight className="inline w-3 h-3 mr-1" />}
                {line.text}
              </div>
            ))
          )}
        </div>
      )}

      {/* Input Area */}
      <div className="relative flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-900 transition-colors">
        {/* Icon */}
        <Terminal className="w-4 h-4 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un comando... (/ para activar, TAB para autocompletar)"
          className="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-mono text-sm"
        />

        {/* Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
            title="Expandir/Contraer output"
          >
            <History className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          <button
            onClick={() => executeCommand('help')}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
            title="Ayuda (HELP)"
          >
            <HelpCircle className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Suggestions Dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-200 dark:bg-slate-800 border border-slate-400 dark:border-slate-600 rounded shadow-lg overflow-hidden">
            {suggestions.map((cmd, i) => (
              <div
                key={cmd.name}
                onClick={() => {
                  setInput(cmd.name + ' ');
                  setSuggestions([]);
                  inputRef.current?.focus();
                }}
                className={`px-3 py-2 cursor-pointer transition-colors ${
                  i === selectedSuggestion
                    ? 'bg-cyan-600 dark:bg-cyan-600 text-white'
                    : 'hover:bg-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <div className="font-semibold text-slate-900 dark:text-white">{cmd.name.toUpperCase()}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">{cmd.description}</div>
                {cmd.syntax && (
                  <div className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">{cmd.syntax}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
