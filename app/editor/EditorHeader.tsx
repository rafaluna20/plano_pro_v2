'use client';

import { useRouter } from 'next/navigation';

interface EditorHeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  backTo?: string;
  actions?: React.ReactNode;
}

export function EditorHeader({ 
  title, 
  subtitle, 
  showBackButton = true, 
  backTo,
  actions 
}: EditorHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backTo) {
      router.push(backTo);
    } else {
      router.back();
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showBackButton && (
            <button
              onClick={handleBack}
              className="text-gray-600 hover:text-gray-900 transition-colors duration-200"
              aria-label="Volver"
            >
              <svg 
                className="w-5 h-5" 
                fill="none" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
          </div>
        </div>
        
        <div className="flex gap-3 items-center">
          {actions}
        </div>
      </div>
    </header>
  );
}
