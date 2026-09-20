import { Check, CreditCard, Truck, ClipboardCheck, CheckCircle } from 'lucide-react';

type StepKey = 'checkout' | 'review' | 'payment' | 'confirmed';

interface Step {
  key: StepKey;
  label: string;
  icon: typeof Truck;
}

const STEPS: Step[] = [
  { key: 'checkout', label: 'Delivery', icon: Truck },
  { key: 'review', label: 'Review', icon: ClipboardCheck },
  { key: 'payment', label: 'Payment', icon: CreditCard },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle },
];

interface CheckoutStepIndicatorProps {
  currentStep: StepKey;
  onStepClick: (step: StepKey) => void;
}

export default function CheckoutStepIndicator({ currentStep, onStepClick }: CheckoutStepIndicatorProps) {
  return (
    <div className="flex items-center justify-center mb-8" role="navigation" aria-label="Checkout progress">
      {STEPS.map((step, i) => {
        const isActive = currentStep === step.key;
        const isComplete = STEPS.findIndex(s => s.key === currentStep) > i;
        const StepIcon = step.icon;
        return (
          <div key={step.key} className="flex items-center">
            <button
              onClick={() => onStepClick(step.key)}
              disabled={!isComplete && !isActive}
              aria-current={isActive ? 'step' : undefined}
              aria-label={`${step.label}${isComplete ? ' (completed)' : isActive ? ' (current)' : ''}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : isComplete
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isComplete ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px mx-2 ${isComplete ? 'bg-primary-300' : 'bg-gray-200'}`} aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export type { StepKey };
