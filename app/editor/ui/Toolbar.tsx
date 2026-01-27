'use client';

import { ReactNode } from 'react';

interface ToolbarProps {
  children: ReactNode;
  className?: string;
}

export function Toolbar({ children, className = '' }: ToolbarProps) {
  return (
    <div className={`bg-white border-b border-gray-200 shadow-sm ${className}`}>
      <div className="px-4 py-2 flex items-center gap-2">
        {children}
      </div>
    </div>
  );
}

interface ToolbarSectionProps {
  children: ReactNode;
  label?: string;
}

export function ToolbarSection({ children, label }: ToolbarSectionProps) {
  return (
    <div className="flex items-center gap-1 px-2 border-l border-gray-200 first:border-l-0 first:pl-0">
      {label && (
        <span className="text-xs text-gray-500 mr-2 font-medium">{label}</span>
      )}
      {children}
    </div>
  );
}
