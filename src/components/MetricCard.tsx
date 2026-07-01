import React from 'react';
import { LucideIcon } from 'lucide-react';
import * as d3 from 'd3';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
    label?: string;
  };
  colorScheme: 'blue' | 'emerald' | 'amber' | 'indigo' | 'slate';
  isLoading?: boolean;
  sparklineData?: number[];
  darkMode?: boolean;
}

const colorPresets = {
  blue: {
    bg: 'bg-blue-50/70 dark:bg-blue-950/40',
    icon: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-100 dark:border-blue-900/60',
    gradient: 'from-blue-500/5 to-transparent',
    sparklineLight: '#2563eb', // blue-600
    sparklineDark: '#60a5fa', // blue-400
  },
  emerald: {
    bg: 'bg-emerald-50/70 dark:bg-emerald-950/40',
    icon: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-100 dark:border-emerald-900/60',
    gradient: 'from-emerald-500/5 to-transparent',
    sparklineLight: '#16a34a', // emerald-600
    sparklineDark: '#34d399', // emerald-400
  },
  amber: {
    bg: 'bg-amber-50/70 dark:bg-amber-950/40',
    icon: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-100 dark:border-amber-900/60',
    gradient: 'from-amber-500/5 to-transparent',
    sparklineLight: '#d97706', // amber-600
    sparklineDark: '#fbbf24', // amber-400
  },
  indigo: {
    bg: 'bg-indigo-50/70 dark:bg-indigo-950/40',
    icon: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-100 dark:border-indigo-900/60',
    gradient: 'from-indigo-500/5 to-transparent',
    sparklineLight: '#4f46e5', // indigo-600
    sparklineDark: '#818cf8', // indigo-400
  },
  slate: {
    bg: 'bg-slate-50/70 dark:bg-slate-800/40',
    icon: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-100 dark:border-slate-750',
    gradient: 'from-slate-500/5 to-transparent',
    sparklineLight: '#475569', // slate-600
    sparklineDark: '#94a3b8', // slate-400
  },
};

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({ data, width = 160, height = 32, color = '#6366f1' }: SparklineProps) {
  if (!data || data.length === 0) return null;

  const margin = { top: 2, right: 2, bottom: 2, left: 2 };
  const adjWidth = width - margin.left - margin.right;
  const adjHeight = height - margin.top - margin.bottom;

  // Create D3 scales
  const xScale = d3.scaleLinear()
    .domain([0, data.length - 1])
    .range([0, adjWidth]);

  const yMin = d3.min(data) ?? 0;
  const yMax = d3.max(data) ?? 1;
  const yDomain = yMin === yMax ? [yMin - 1, yMax + 1] : [yMin, yMax];

  const yScale = d3.scaleLinear()
    .domain(yDomain)
    .range([adjHeight, 0]);

  // Line generator
  const lineGenerator = d3.line<number>()
    .x((_, i) => xScale(i))
    .y((d) => yScale(d))
    .curve(d3.curveMonotoneX);

  // Area generator
  const areaGenerator = d3.area<number>()
    .x((_, i) => xScale(i))
    .y0(adjHeight)
    .y1((d) => yScale(d))
    .curve(d3.curveMonotoneX);

  const pathD = lineGenerator(data) || '';
  const areaD = areaGenerator(data) || '';
  const gradId = React.useId().replace(/:/g, '');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0.0} />
        </linearGradient>
      </defs>
      <g transform={`translate(${margin.left}, ${margin.top})`}>
        <path d={areaD} fill={`url(#${gradId})`} />
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={xScale(data.length - 1)}
          cy={yScale(data[data.length - 1])}
          r={2.5}
          fill={color}
          className="animate-pulse"
        />
      </g>
    </svg>
  );
}

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  colorScheme = 'blue',
  isLoading = false,
  sparklineData,
  darkMode = false,
}: MetricCardProps) {
  const scheme = colorPresets[colorScheme];
  const isHe = /[\u0590-\u05FF]/.test(title);

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm animate-pulse">
        <div className="relative flex items-start justify-between">
          <div className="space-y-2 w-2/3">
            <div className="h-3.5 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-7 w-2/3 rounded bg-slate-200 dark:bg-slate-800 mt-1" />
          </div>
          <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
        </div>
        
        {/* Placeholder skeleton for sparkline to prevent layout shifts */}
        {sparklineData && (
          <div className="h-10 w-full mt-3 rounded bg-slate-50 dark:bg-slate-800/50" />
        )}
        
        <div className="relative mt-3.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2.5">
          <div className="h-3 w-1/3 rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-3 w-1/4 rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  return (
    <div className={`kpi-card relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700`}>
      {/* Decorative gradient corner */}
      <div className={`absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${scheme.gradient} blur-xl`} />

      <div className="relative flex items-start justify-between">
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {title}
          </span>
          <h3 className="font-sans text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {value}
          </h3>
        </div>
        
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${scheme.bg} ${scheme.border} border shadow-inner`}>
          <Icon className={`h-4.5 w-4.5 ${scheme.icon}`} />
        </div>
      </div>

      {/* D3-powered Sparkline visualization */}
      {sparklineData && sparklineData.length > 0 && (
        <div className="relative mt-3 h-10 flex items-center justify-between gap-2">
          <div className="flex-1 h-full flex items-center min-w-0">
            <Sparkline 
              data={sparklineData} 
              width={160} 
              height={32} 
              color={darkMode ? scheme.sparklineDark : scheme.sparklineLight} 
            />
          </div>
          <div className="text-right shrink-0 flex flex-col justify-center">
            <span className="text-[9px] font-bold block text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {isHe ? 'מגמת 7 ימים' : '7D Trend'}
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
              {sparklineData[0]} → {sparklineData[sparklineData.length - 1]}
            </span>
          </div>
        </div>
      )}

      {(trend || subtitle) && (
        <div className="relative mt-3.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2.5">
          {trend ? (
            <div className="flex items-center gap-1.5">
              <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                trend.isPositive 
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' 
                  : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400'
              }`}>
                {trend.isPositive ? '↑' : '↓'} {trend.value}
              </span>
              {trend.label && (
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                  {trend.label}
                </span>
              )}
            </div>
          ) : <div />}

          {subtitle && (
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 max-w-[180px] truncate" title={subtitle}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
