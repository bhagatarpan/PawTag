import React from 'react';
import {
  Package,
  Truck,
  CheckCircle,
  Check,
  Clock,
  CreditCard,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const ORDER_STATUS_STEPS = ['pending', 'paid', 'packing', 'shipped', 'delivered'];

export const STEP_LABELS: Record<string, string> = {
  pending: 'Pending',
  paid: 'Paid',
  packing: 'Packing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const STEP_ICON: Record<string, React.FC<{ className?: string }>> = {
  pending: Clock,
  paid: CreditCard,
  packing: Package,
  shipped: Truck,
  delivered: CheckCircle,
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface OrderProgressStepperProps {
  status: string;
  variant: 'compact' | 'full';
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function OrderProgressStepper({ status, variant, className }: OrderProgressStepperProps) {
  const currentStep = ORDER_STATUS_STEPS.indexOf(status);
  const isCancelled = status === 'cancelled' || status === 'refunded';

  if (isCancelled) {
    return null;
  }

  if (variant === 'compact') {
    return <CompactStepper status={status} currentStep={currentStep} className={className} />;
  }

  return <FullStepper status={status} currentStep={currentStep} className={className} />;
}

/* ------------------------------------------------------------------ */
/*  Compact Variant (for list cards)                                   */
/* ------------------------------------------------------------------ */

function CompactStepper({
  status,
  currentStep,
  className,
}: {
  status: string;
  currentStep: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="relative flex items-center justify-between">
        {/* Track background */}
        <div className="absolute top-[5px] left-[10px] right-[10px] h-0.5 bg-gray-200 rounded-full" />
        {/* Fill bar */}
        <div
          className="absolute top-[5px] left-[10px] h-0.5 bg-primary-500 rounded-full transition-all duration-500"
          style={{
            width: currentStep >= 0
              ? `calc(${Math.min(currentStep, ORDER_STATUS_STEPS.length - 1)} / ${ORDER_STATUS_STEPS.length - 1} * (100% - 20px))`
              : '0%',
          }}
        />
        {/* Step dots */}
        {ORDER_STATUS_STEPS.map((step, i) => {
          const isDone = currentStep >= 0 && i < currentStep;
          const isCurrent = i === currentStep;
          return (
            <div key={step} className="relative z-10 flex flex-col items-center" style={{ width: `${100 / ORDER_STATUS_STEPS.length}%` }}>
              <div
                className={`w-[10px] h-[10px] rounded-full border-2 transition-all ${
                  isDone || isCurrent
                    ? 'bg-primary-500 border-primary-500'
                    : 'bg-white border-gray-300'
                }`}
              />
              <span className={`text-[9px] mt-1 font-medium ${
                isDone || isCurrent ? 'text-primary-600' : 'text-gray-400'
              }`}>
                {STEP_LABELS[step] || step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Full Variant (for detail view)                                     */
/* ------------------------------------------------------------------ */

function FullStepper({
  status,
  currentStep,
  className,
}: {
  status: string;
  currentStep: number;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 ${className || ''}`}>
      <h2 className="text-sm font-semibold text-gray-700 mb-5">Order Progress</h2>

      {/* Stepper */}
      <div className="relative mb-8">
        {/* Track background */}
        <div className="absolute top-[15px] left-[15px] right-[15px] h-1 bg-gray-200 rounded-full" />
        {/* Fill bar */}
        <div
          className="absolute top-[15px] left-[15px] h-1 bg-primary-500 rounded-full transition-all duration-700 ease-out"
          style={{
            width: currentStep >= 0
              ? `calc(${Math.min(currentStep, ORDER_STATUS_STEPS.length - 1)} / ${ORDER_STATUS_STEPS.length - 1} * (100% - 30px))`
              : '0px',
          }}
        />
        {/* Steps */}
        <div className="relative flex justify-between">
          {ORDER_STATUS_STEPS.map((step, i) => {
            const isDone = currentStep >= 0 && i < currentStep;
            const isCurrent = i === currentStep;
            const StepIcon = STEP_ICON[step] || Clock;
            return (
              <div key={step} className="flex flex-col items-center" style={{ width: `${100 / ORDER_STATUS_STEPS.length}%` }}>
                <div
                  className={`w-[30px] h-[30px] rounded-full flex items-center justify-center z-10 transition-all ${
                    isDone
                      ? 'bg-primary-600 text-white'
                      : isCurrent
                      ? 'bg-primary-600 text-white ring-2 ring-offset-2 ring-primary-200'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {isDone ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <StepIcon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={`text-xs mt-2 font-medium text-center ${
                    isDone || isCurrent ? 'text-primary-700' : 'text-gray-400'
                  }`}
                >
                  {STEP_LABELS[step] || step}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default OrderProgressStepper;
