'use client';

interface WorkflowStepsProps {
  currentStep: 1 | 2 | 3 | 4;
  onStepClick?: (step: 1 | 2 | 3 | 4) => void;
}

export function WorkflowSteps({ currentStep, onStepClick }: WorkflowStepsProps) {
  const steps = [
    { num: 1, label: 'Ubicar', icon: '📍', description: 'Buscar en mapa' },
    { num: 2, label: 'Dibujar', icon: '✏️', description: 'Crear perímetro' },
    { num: 3, label: 'Verificar', icon: '✓', description: 'Revisar en mapa' },
    { num: 4, label: 'Enviar', icon: '📤', description: 'Generar plano' }
  ];

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, index) => (
        <div key={step.num} className="flex items-center gap-1">
          <button
            onClick={() => onStepClick?.(step.num as 1 | 2 | 3 | 4)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all text-xs ${
              currentStep === step.num
                ? 'bg-blue-600 text-white shadow-md'
                : currentStep > step.num
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            } ${onStepClick ? 'cursor-pointer' : 'cursor-default'}`}
            disabled={!onStepClick}
            title={step.description}
          >
            <span className="mr-1">{step.icon}</span>
            {step.label}
          </button>
          {index < steps.length - 1 && (
            <div className={`w-6 h-0.5 ${
              currentStep > step.num ? 'bg-green-400' : 'bg-gray-300'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}
