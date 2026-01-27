'use client';

import { WizardStep } from '@/types/editor';

interface StepIndicatorProps {
  currentStep: WizardStep;
}

const steps = [
  { number: 1, label: 'Método' },
  { number: 2, label: 'Datos' },
  { number: 3, label: 'Edición' },
  { number: 4, label: 'Propiedades' },
  { number: 5, label: 'Revisión' }
];

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="w-full">
      {/* Progress bar visual */}
      <div className="flex items-center justify-between mb-2">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center flex-1">
            {/* Step circle */}
            <div className="relative flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                  step.number < currentStep
                    ? 'bg-green-600 text-white'
                    : step.number === currentStep
                    ? 'bg-blue-600 text-white ring-4 ring-blue-200'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step.number < currentStep ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`mt-2 text-xs font-medium ${
                  step.number === currentStep
                    ? 'text-blue-600'
                    : step.number < currentStep
                    ? 'text-green-600'
                    : 'text-gray-500'
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connecting line */}
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 transition-all duration-300 ${
                  step.number < currentStep
                    ? 'bg-green-600'
                    : 'bg-gray-200'
                }`}
                style={{ marginTop: '-24px' }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step title and description */}
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">
          Paso {currentStep} de {steps.length}: <span className="font-semibold">{steps[currentStep - 1].label}</span>
        </p>
      </div>
    </div>
  );
}
