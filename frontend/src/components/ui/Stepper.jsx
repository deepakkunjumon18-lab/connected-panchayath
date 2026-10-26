import React from 'react';
import { Check } from 'lucide-react';

export default function Stepper({ steps = [], currentStep = 1, onStepClick, className = '' }) {
  return (
    <div className={`w-full py-4 ${className}`}>
      <div className="flex items-center justify-between relative">
        {steps.map((step, idx) => {
          const stepNumber = idx + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isClickable = onStepClick && isCompleted;

          return (
            <React.Fragment key={step.title || idx}>
              {/* Connector line */}
              {idx > 0 && (
                <div
                  className={`flex-1 h-0.5 mx-2 sm:mx-4 transition-colors duration-200 ${
                    stepNumber <= currentStep ? 'bg-primary-600' : 'bg-line'
                  }`}
                />
              )}

              {/* Step indicator */}
              <div
                onClick={() => isClickable && onStepClick(stepNumber)}
                className={`flex flex-col items-center group ${
                  isClickable ? 'cursor-pointer' : ''
                }`}
              >
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm transition-all duration-200 border-2 ${
                    isCompleted
                      ? 'bg-primary-600 border-primary-600 text-white shadow-soft-sm'
                      : isCurrent
                      ? 'bg-white border-primary-600 text-primary-600 ring-4 ring-primary-100 shadow-soft-sm'
                      : 'bg-white border-line text-muted'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" /> : stepNumber}
                </div>
                <div className="text-center mt-2">
                  <p
                    className={`text-xs font-semibold whitespace-nowrap transition-colors ${
                      isCurrent ? 'text-primary-600' : isCompleted ? 'text-ink' : 'text-muted'
                    }`}
                  >
                    {step.title}
                  </p>
                  {step.subtitle && (
                    <p className="text-[11px] text-muted hidden sm:block mt-0.5">{step.subtitle}</p>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
