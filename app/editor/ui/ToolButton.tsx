'use client';

import { ReactNode } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

interface ToolButtonProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  shortcut?: string;
  onClick?: () => void;
}

export function ToolButton({
  icon,
  label,
  active = false,
  disabled = false,
  shortcut,
  onClick
}: ToolButtonProps) {
  return (
    <Tooltip.Provider>
      <Tooltip.Root delayDuration={300}>
        <Tooltip.Trigger asChild>
          <button
            onClick={onClick}
            disabled={disabled}
            className={`tool-button ${active ? 'active' : ''}`}
            aria-label={label}
          >
            {icon}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg z-50"
            sideOffset={5}
          >
            <div className="flex items-center gap-2">
              <span>{label}</span>
              {shortcut && (
                <kbd className="px-1 bg-gray-800 rounded text-xs font-mono">
                  {shortcut}
                </kbd>
              )}
            </div>
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
