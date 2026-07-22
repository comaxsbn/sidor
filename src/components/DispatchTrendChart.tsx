import React, { useMemo, useState } from 'react';
import { Order, Language } from '../types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { Activity, CheckCircle2, Clock, ChevronUp, ChevronDown, TrendingUp } from 'lucide-react';

interface DispatchTrendChartProps {
  orders: Order[];
  lang: Language;
}

export function DispatchTrendChart({ orders, lang }: DispatchTrendChartProps) {
  const isHe = lang === 'he';
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Compute 7-day progression data
  const trendData = useMemo(() => {
    const now = new Date();
    const days: Array<{
      dateKey: string;
      dateLabel: string;
      weekdayLabel: string;
      pending: number;
      processing: number;
      delivered: number;
      cancelled: number;
      total: number;
    }> = [];

    const hebDays = ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'ש\''];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      const dateLabel = `${day}/${month}`;
      const dayOfWeek = hebDays[d.getDay()];
      const weekdayLabel = isHe ? `יום ${dayOfWeek}` : d.toLocaleDateString('en-US', { weekday: 'short' });

      days.push({
        dateKey,
        dateLabel,
        weekdayLabel,
        pending: 0,
        processing: 0,
        delivered: 0,
        cancelled: 0,
        total: 0
      });
    }

    orders.forEach(order => {
      if (!order.timestamp) return;
      const d = new Date(order.timestamp);
      if (isNaN(d.getTime())) return;

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      const entry = days.find(item => item.dateKey === dateKey);
      if (entry) {
        entry.total += 1;
        const st = order.status || 'pending';
        if (st === 'delivered') entry.delivered += 1;
        else if (st === 'processing') entry.processing += 1;
        else if (st === 'cancelled') entry.cancelled += 1;
        else entry.pending += 1;
      }
    });

    return days;
  }, [orders, isHe]);

  const totals = useMemo(() => {
    const totalOrders = trendData.reduce((acc, d) => acc + d.total, 0);
    const deliveredCount = trendData.reduce((acc, d) => acc + d.delivered, 0);
    const processingCount = trendData.reduce((acc, d) => acc + d.processing, 0);
    const pendingCount = trendData.reduce((acc, d) => acc + d.pending, 0);
    const deliveredPct = totalOrders > 0 ? Math.round((deliveredCount / totalOrders) * 100) : 0;

    return {
      totalOrders,
      deliveredCount,
      processingCount,
      pendingCount,
      deliveredPct
    };
  }, [trendData]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-700/80 text-xs backdrop-blur-md space-y-1.5 min-w-[170px] z-50">
          <div className="font-bold border-b border-slate-700/80 pb-1 text-slate-200 flex items-center justify-between gap-2">
            <span>{data.weekdayLabel} ({data.dateLabel})</span>
            <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
              {isHe ? `סה"כ: ${data.total}` : `Total: ${data.total}`}
            </span>
          </div>
          <div className="space-y-1 pt-0.5 font-medium">
            <div className="flex items-center justify-between text-emerald-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                {isHe ? 'נמסר ליעד' : 'Delivered'}:
              </span>
              <span className="font-mono font-bold">{data.delivered}</span>
            </div>
            <div className="flex items-center justify-between text-blue-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-400"></span>
                {isHe ? 'בטיפול / בהובלה' : 'Processing'}:
              </span>
              <span className="font-mono font-bold">{data.processing}</span>
            </div>
            <div className="flex items-center justify-between text-amber-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                {isHe ? 'חדש / ממתין' : 'Pending'}:
              </span>
              <span className="font-mono font-bold">{data.pending}</span>
            </div>
            {data.cancelled > 0 && (
              <div className="flex items-center justify-between text-rose-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-400"></span>
                  {isHe ? 'בוטל' : 'Cancelled'}:
                </span>
                <span className="font-mono font-bold">{data.cancelled}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl border border-indigo-100">
            <Activity className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>{isHe ? 'מגמת סטטוס משלוחים יומי (7 ימים אחרונים)' : '7-Day Dispatch Status Progression'}</span>
              <span className="text-[10px] font-mono font-extrabold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100/80">
                LIVE
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isHe
                ? 'מעקב ויזואלי אחר שינויי סטטוס הפצה: ממתין, בטיפול ונמסר'
                : 'Visual tracking of order progression: pending, processing, and delivered'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-100 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>{isHe ? 'שיעור מסירה:' : 'Delivered Rate:'}</span>
            <span className="font-mono font-extrabold">{totals.deliveredPct}%</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-100 font-medium">
            <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>{isHe ? 'פעילים בצנרת:' : 'In Pipeline:'}</span>
            <span className="font-mono font-extrabold">{totals.pendingCount + totals.processingCount}</span>
          </div>

          {/* Collapse/Expand Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 p-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            title={isCollapsed ? (isHe ? 'הצג גרף' : 'Show Chart') : (isHe ? 'מזער גרף' : 'Collapse Chart')}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Chart Section */}
      {!isCollapsed && (
        <div className="w-full pt-1">
          <div className="w-full h-52 sm:h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trendData}
                margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                  formatter={(value) => <span className="text-slate-700 font-medium text-xs">{value}</span>}
                />
                <Line
                  type="monotone"
                  dataKey="delivered"
                  name={isHe ? 'נמסר ליעד' : 'Delivered'}
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="processing"
                  name={isHe ? 'בטיפול / בהובלה' : 'Processing'}
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="pending"
                  name={isHe ? 'ממתין / חדש' : 'Pending'}
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="cancelled"
                  name={isHe ? 'בוטל' : 'Cancelled'}
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#ef4444' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
