'use client';

import { useWizardStore } from '@/lib/editor/wizardStore';
import { WizardStep } from '@/types/editor';
import { StepIndicator } from './StepIndicator';
import { WizardStep1_Method } from './WizardStep1_Method';
import { WizardStep2_Data } from './WizardStep2_Data';
import { WizardStep3_Edit } from './WizardStep3_Edit';
import { WizardStep4_Properties } from './WizardStep4_Properties';
import { WizardStep5_Review } from './WizardStep5_Review';

export function EditorWizard() {
  const { currentStep, previousStep, nextStep, canProceed } = useWizardStore();

  const renderStep = () => {
    switch (currentStep) {
      case WizardStep.METHOD:
        return <WizardStep1_Method />;
      case WizardStep.DATA:
        return <WizardStep2_Data />;
      case WizardStep.EDIT:
        return <WizardStep3_Edit />;
      case WizardStep.PROPERTIES:
        return <WizardStep4_Properties />;
      case WizardStep.REVIEW:
        return <WizardStep5_Review />;
      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case WizardStep.METHOD:
        return 'Selecciona el Método de Entrada';
      case WizardStep.DATA:
        return 'Ingresa los Datos';
      case WizardStep.EDIT:
        return 'Edita en el Mapa';
      case WizardStep.PROPERTIES:
        return 'Completa las Propiedades';
      case WizardStep.REVIEW:
        return 'Revisa y Genera';
      default:
        return '';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header con indicador de pasos */}
      <div className="bg-white border-b border-gray-200 shadow-sm p-6">
        <div className="max-w-4xl mx-auto">
          <StepIndicator currentStep={currentStep} />
        </div>
      </div>

      {/* Contenido del paso */}
      <div className="flex-1 overflow-y-auto py-8 px-6">
        <div className="animate-fadeIn">
          {renderStep()}
        </div>
      </div>

      {/* Footer con botones de navegación */}
      <div className="bg-white border-t border-gray-200 shadow-lg p-6">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <button
            onClick={previousStep}
            disabled={currentStep === WizardStep.METHOD}
            className={`px-6 py-2.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
              currentStep === WizardStep.METHOD
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:shadow-sm'
            }`}
          >
            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M15 19l-7-7 7-7"></path>
            </svg>
            Anterior
          </button>
          
          <div className="flex items-center gap-3">
            {/* Progress text */}
            <span className="text-sm text-gray-600">
              {canProceed() ? (
                <span className="text-green-600 font-medium">✓ Listo para continuar</span>
              ) : (
                <span className="text-amber-600">⚠ Completa los campos requeridos</span>
              )}
            </span>

            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className={`px-6 py-2.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
                canProceed()
                  ? 'text-white bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'
                  : 'text-gray-400 bg-gray-200 cursor-not-allowed'
              }`}
            >
              {currentStep === WizardStep.REVIEW ? (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Completar
                </>
              ) : (
                <>
                  Siguiente
                  <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M9 5l7 7-7 7"></path>
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
