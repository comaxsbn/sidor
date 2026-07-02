import React from 'react';
import { Order, OrderStatus } from '../types';

interface QuickFilterProps {
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
  orders: Order[];
  isHe: boolean;
  filteredCount: number;
}

export const QuickFilter: React.FC<QuickFilterProps> = ({
  selectedStatus,
  onSelectStatus,
  orders,
  isHe,
  filteredCount,
}) => {
  // Count stats based on order database
  const countAll = orders.length;
  const countPending = orders.filter((o) => o.status === 'pending').length;
  const countProcessing = orders.filter((o) => o.status === 'processing').length;
  const countDelivered = orders.filter((o) => o.status === 'delivered').length;

  const filterOptions = [
    { id: 'all', labelHe: 'הכל', labelEn: 'All', count: countAll, color: 'blue' },
    { id: 'pending', labelHe: 'חדש', labelEn: 'Pending', count: countPending, color: 'amber' },
    { id: 'processing', labelHe: 'בטיפול', labelEn: 'In-Transit', count: countProcessing, color: 'blue' },
    { id: 'delivered', labelHe: 'נמסר', labelEn: 'Delivered', count: countDelivered, color: 'emerald' },
  ];

  return (
    <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center gap-3 justify-between">
      <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
          {isHe ? 'סינון מהיר:' : 'Quick Filter:'}
        </span>
        {filterOptions.map((pill) => {
          const isActive = selectedStatus === pill.id;

          let activeClass = '';
          const inactiveClass = 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50 hover:text-slate-900';

          if (pill.color === 'amber') {
            activeClass = 'bg-amber-600 text-white border-amber-600 shadow-amber-100 shadow-xs font-black';
          } else if (pill.color === 'emerald') {
            activeClass = 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-100 shadow-xs font-black';
          } else {
            activeClass = 'bg-blue-600 text-white border-blue-600 shadow-blue-100 shadow-xs font-black';
          }

          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => onSelectStatus(pill.id)}
              className={`rounded-full px-3.5 py-1 text-xs font-bold border flex items-center gap-2 transition-all duration-200 ease-out gpu-scale-hover hover-border-inset touch-active-state cursor-pointer ${
                isActive ? activeClass : inactiveClass
              }`}
            >
              <span>{isHe ? pill.labelHe : pill.labelEn}</span>
              <span
                className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-bold font-mono transition-colors ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {pill.count}
              </span>
            </button>
          );
        })}
      </div>
      <div className="text-[10px] text-slate-400 font-bold hidden sm:block">
        {isHe
          ? `מציג ${filteredCount} מתוך ${orders.length} הזמנות`
          : `Showing ${filteredCount} of ${orders.length} orders`}
      </div>
    </div>
  );
};
