import { cn } from "@/lib/utils";

interface HealthFactorGaugeProps {
  value: number; // Health factor value
  className?: string;
}

export function HealthFactorGauge({ value, className }: HealthFactorGaugeProps) {
  // Convert health factor to percentage for display (cap at 100%)
  const percentage = Math.min((value / 2) * 100, 100);
  
  // Determine color based on health factor
  const getColor = (healthFactor: number) => {
    if (healthFactor >= 1.5) return "text-green-600";
    if (healthFactor >= 1.2) return "text-yellow-600"; 
    return "text-red-600";
  };

  const getStrokeColor = (healthFactor: number) => {
    if (healthFactor >= 1.5) return "#16a34a";
    if (healthFactor >= 1.2) return "#ca8a04";
    return "#dc2626";
  };

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn("relative w-30 h-30", className)}>
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="#e5e7eb"
          strokeWidth="8"
          fill="transparent"
        />
        
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke={getStrokeColor(value)}
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300"
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className={cn("text-2xl font-bold", getColor(value))}>
            {value.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">Health Factor</div>
        </div>
      </div>
    </div>
  );
}
