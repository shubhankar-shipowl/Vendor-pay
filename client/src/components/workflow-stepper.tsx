interface WorkflowStepperProps {
  currentStep: number;
}

export function WorkflowStepper({ currentStep }: WorkflowStepperProps) {
  const steps = [
    { number: 1, title: "Upload Data" },
    { number: 2, title: "Map Columns" },
    { number: 3, title: "Price/HSN Setup" },
    { number: 4, title: "Generate Reports" }
  ];

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              {steps.map((step, index) => (
                <div key={step.number}>
                  <div className={`flex items-center space-x-2 ${
                    step.number <= currentStep ? 'text-primary' : 'text-gray-400'
                  }`} data-testid={`step-${step.number}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step.number <= currentStep 
                        ? 'bg-primary text-white' 
                        : 'bg-gray-300 text-gray-500'
                    }`}>
                      {step.number}
                    </div>
                    <span className={`font-medium ${
                      step.number <= currentStep ? 'text-primary' : 'text-gray-400'
                    }`}>
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="w-12 h-0.5 bg-gray-300 ml-8 mt-4"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
