import React, { useState, useMemo } from 'react';
import { Order } from '../types';
import { Copy, Check, FileText, Lock, Unlock, AlertTriangle, Building, Truck, Clock, Calendar } from 'lucide-react';
import { translate } from '../utils/api';

const DRIVERS = [
  { name: 'חכמת', type: 'מנוף', icon: '🏗️' },
  { name: 'עלי', type: 'משאית', icon: '🚛' },
];

const getShortWarehouseName = (wh: string) => {
  if (wh.includes('החרש')) return 'החרש';
  if (wh.includes('התלמיד')) return 'התלמיד';
  return wh.replace('מחסן', '').trim();
};

const getDriverForOrder = (order: Order, index: number) => {
  const notesLower = (order.notes || '').toLowerCase();
  if (notesLower.includes('מנוף') || notesLower.includes('crane')) {
    return DRIVERS[0]; // חכמת (מנוף)
  }
  let charSum = 0;
  for (let i = 0; i < order.orderNumber.length; i++) {
    charSum += order.orderNumber.charCodeAt(i);
  }
  const driverIndex = (charSum + index) % DRIVERS.length;
  return DRIVERS[driverIndex];
};

const getOrderTimeStr = (timestamp: string) => {
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '08:00';
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (e) {
    return '08:00';
  }
};

interface MorningReportProps {
  orders: Order[];
  lang: 'he' | 'en';
}

export default function MorningReport({ orders, lang }: MorningReportProps) {
  const isHe = lang === 'he';
  const [copied, setCopied] = useState(false);
  const includeFinancials = false;

  // Aggregations
  const stats = useMemo(() => {
    const active = orders.filter(o => o.status !== 'cancelled');
    const total = orders.length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const pending = orders.filter(o => o.status === 'pending').length;
    const processing = orders.filter(o => o.status === 'processing').length;
    const cancelled = orders.filter(o => o.status === 'cancelled').length;

    const charashCount = orders.filter(o => {
      const isCharash = o.warehouse.includes('החרש') || o.warehouse.toLowerCase().includes('charash');
      return isCharash && o.status !== 'cancelled' && o.status !== 'delivered';
    }).length;

    const talmidCount = orders.filter(o => {
      const isTalmid = o.warehouse.includes('התלמיד') || o.warehouse.toLowerCase().includes('talmid');
      return isTalmid && o.status !== 'cancelled' && o.status !== 'delivered';
    }).length;

    // Potential bottleneck shipments (pending and older than 1 day or has delays/special notes)
    const criticalIssues = orders.filter(o => {
      const isAwaiting = o.status === 'pending' || o.status === 'processing';
      const hasNote = o.notes && (o.notes.includes('עיכוב') || o.notes.includes('דחוף') || o.notes.toLowerCase().includes('delay') || o.notes.toLowerCase().includes('urgent'));
      return isAwaiting && (hasNote || false);
    });

    const successRate = total > 0 ? Math.round((delivered / total) * 100) : 0;

    return {
      total,
      delivered,
      pending,
      processing,
      cancelled,
      charashCount,
      talmidCount,
      criticalIssues,
      successRate
    };
  }, [orders]);

  const currentDateStr = useMemo(() => {
    const today = new Date();
    return today.toLocaleDateString('he-IL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  // WhatsApp formatted report text
  const reportText = useMemo(() => {
    const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'processing');
    const displayOrders = activeOrders.length > 0 ? activeOrders : orders.slice(0, 5);

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dateFormatted = `${dd}/${mm}/${yyyy}`;

    let text = `📅 *דוח בוקר - ח. סבן | ${dateFormatted}*\n\n`;

    // Group display orders by driver
    const driverGroups: Record<string, { driver: typeof DRIVERS[0], orders: Order[] }> = {};
    
    DRIVERS.forEach(d => {
      driverGroups[d.name] = { driver: d, orders: [] };
    });

    displayOrders.forEach((o, idx) => {
      const dr = getDriverForOrder(o, idx);
      if (!driverGroups[dr.name]) {
        driverGroups[dr.name] = { driver: dr, orders: [] };
      }
      driverGroups[dr.name].orders.push(o);
    });

    // Append driver blocks
    Object.values(driverGroups).forEach(group => {
      if (group.orders.length === 0) return;
      
      text += `👤 *${group.driver.name} (${group.driver.type} ${group.driver.icon}):*\n`;
      group.orders.forEach(o => {
        const timeStr = getOrderTimeStr(o.timestamp);
        const shortWh = getShortWarehouseName(o.warehouse);
        text += `• ${timeStr} | #${o.orderNumber} ${translate(o.customerName, 'he')} - ${translate(o.deliveryAddress, 'he')} (מחסן ${shortWh})\n`;
      });
      text += `\n`;
    });

    // Aggregations
    const whCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    
    displayOrders.forEach((o, idx) => {
      const shortWh = getShortWarehouseName(o.warehouse);
      whCounts[shortWh] = (whCounts[shortWh] || 0) + 1;
      
      const dr = getDriverForOrder(o, idx);
      typeCounts[dr.type] = (typeCounts[dr.type] || 0) + 1;
    });

    const whSummaryStr = Object.entries(whCounts)
      .map(([name, count]) => `${name} (${count})`)
      .join(' | ');

    const typeSummaryStr = Object.entries(typeCounts)
      .map(([name, count]) => `${name} (${count})`)
      .join(' | ');

    text += `📊 *סיכום סידור:*\n`;
    text += `סה"כ הזמנות: ${displayOrders.length}\n`;
    text += `📦 מהמחסנים: ${whSummaryStr}\n`;
    text += `🚛 סוגי הובלה: ${typeSummaryStr}\n\n`;

    if (includeFinancials) {
      const totalAmount = displayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      text += `💰 *שווי כולל של הסבב:* *₪${totalAmount.toLocaleString()}*\n\n`;
    }

    text += `סידור נעים, שיהיה לנו בוקר טוב! ✨`;

    return text;
  }, [orders, includeFinancials]);

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="morning-report-section" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row" dir="rtl">
      {/* Configuration & visual statistics */}
      <div className="p-5 md:w-1/2 border-b md:border-b-0 md:border-l border-slate-100 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">סיכום בוקר אוטומטי</h3>
              <p className="text-[11px] text-slate-500">מידע לוגיסטי מסוכם להפצה נגישה בוואטסאפ</p>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold">
                <Calendar className="h-3 w-3 text-slate-400" />
                <span>תאריך סבב</span>
              </div>
              <p className="text-xs font-black text-slate-800 mt-1 truncate">דוח הבוקר</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold">
                <Truck className="h-3 w-3 text-blue-500" />
                <span>הפצות בצנרת</span>
              </div>
              <p className="text-xs font-black text-slate-800 mt-1">
                {stats.pending + stats.processing} הזמנות
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold">
                <Building className="h-3 w-3 text-orange-500" />
                <span>מחסנים פעילים</span>
              </div>
              <p className="text-xs font-semibold text-slate-700 mt-1">
                החרש: {stats.charashCount} | התלמיד: {stats.talmidCount}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold">
                <AlertTriangle className="h-3 w-3 text-red-500" />
                <span>משלוחים חריגים</span>
              </div>
              <p className={`text-xs font-black mt-1 ${stats.criticalIssues.length > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-700'}`}>
                {stats.criticalIssues.length} הזמנות
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl transition-all shadow-md shadow-emerald-700/10 text-xs md:text-sm cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="h-4.5 w-4.5" />
              <span>הועתק ללוח בהצלחה!</span>
            </>
          ) : (
            <>
              <Copy className="h-4.5 w-4.5" />
              <span>העתק דוח מותאם לוואטסאפ (WhatsApp)</span>
            </>
          )}
        </button>
      </div>

      {/* Real-time formatted copy output preview */}
      <div className="p-5 md:w-1/2 bg-slate-900/95 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black">תצוגה מקדימה של תוכן וואטסאפ</span>
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
        <div className="flex-1 bg-slate-950 rounded-xl p-4 border border-slate-800 overflow-y-auto max-h-[300px] text-[11px] font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed select-all cursor-text scrollbar-thin">
          {reportText}
        </div>
      </div>
    </div>
  );
}
