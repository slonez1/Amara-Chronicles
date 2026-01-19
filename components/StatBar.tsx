import React from 'react';

interface StatBarProps {
  label: string;
  current: number;
  max: number;
  color: 'rose' | 'red' | 'green' | 'blue';
  icon: string;
}

const StatBar: React.FC<StatBarProps> = ({ label, current, max, color, icon }) => {
  const percentage = Math.min(100, Math.max(0, (current / max) * 100));
  
  const colorClasses = {
    rose: {
      bg: 'bg-rose-600',
      text: 'text-rose-500',
      shadow: 'shadow-[0_0_8px_rgba(225,29,72,0.4)]'
    },
    red: {
      bg: 'bg-red-600',
      text: 'text-red-500',
      shadow: 'shadow-[0_0_8px_rgba(220,38,38,0.4)]'
    },
    green: {
      bg: 'bg-green-600',
      text: 'text-green-500',
      shadow: 'shadow-[0_0_8px_rgba(22,163,74,0.4)]'
    },
    blue: {
      bg: 'bg-blue-600',
      text: 'text-blue-500',
      shadow: 'shadow-[0_0_8px_rgba(37,99,235,0.4)]'
    }
  };

  const colors = colorClasses[color];

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <i className={`${icon} ${colors.text}`}></i>
          {label}
        </span>
        <span className={`text-[10px] font-mono ${colors.text}`}>
          {current} / {max}
        </span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colors.bg} ${colors.shadow} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default StatBar;
