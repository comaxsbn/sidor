import React, { useState, useMemo } from 'react';
import { Order } from '../types';
import { Copy, Check, FileText, Lock, Unlock, AlertTriangle, Building, Truck, Clock, Calendar } from 'lucide-react';

interface MorningReportProps {
  orders: Order[];
  lang: 'he' | 'en';
}

export default function MorningReport({ orders, lang }: MorningReportProps) {
  const isHe = lang === 'he';
  const [copied, setCopied] = useState(false);
  const [includeFinancials, setIncludeFinancials] = useState(false);

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

    // Financial valuation
    const totalValue = active.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const deliveredValue = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const pendingValue = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').reduce((sum, o) => sum + (o.totalAmount || 0), 0);

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
      totalValue,
      deliveredValue,
      pendingValue,
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
    const activeDeliv = stats.pending + stats.processing;
    
    let text = `*📋 דוח בוקר לוגיסטי יומי - SabanOS*\n`;
    text += `*תאריך:* ${currentDateStr}\n`;
    text += `*סטטוס הפצה כללי:*\n\n`;
    
    text += `📦 *סה"כ הזמנות רשומות:* ${stats.total}\n`;
    text += `🚚 *משלוחים בצנרת (פעילים):* ${activeDeliv}\n`;
    text += `✅ *סופקו בהצלחה:* ${stats.delivered}\n`;
    text += `⏳ *בהמתנה לטעינה:* ${stats.pending}\n`;
    text += `⚙️ *בטיפול/הכנה:* ${stats.processing}\n`;
    text += `❌ *בוטלו:* ${stats.cancelled}\n\n`;

    text += `*🏭 חלוקת עומס בין מחסנים (הזמנות פעילות):*\n`;
    text += `🔹 מחסן החרש: *${stats.charashCount}* משלוחים\n`;
    text += `🔹 מחסן התלמיד: *${stats.talmidCount}* משלוחים\n\n`;

    if (includeFinancials) {
      text += `*🔒 נתוני שווי פיננסי (מורשה):*\n`;
      text += `💰 שווי כולל של הסבב: *₪${stats.totalValue.toLocaleString()}*\n`;
      text += `🟢 שווי הזמנות שסופקו: *₪${stats.deliveredValue.toLocaleString()}*\n`;
      text += `🟡 שווי בצנרת להפצה: *₪${stats.pendingValue.toLocaleString()}*\n\n`;
    } else {
      text += `*🔒 אבטחת מידע פיננסי:*\n`;
      text += `_נתוני שווי משלוחים הושמטו מהדוח הסטנדרטי לשמירה על סודיות._\n\n`;
    }

    text += `*⚠️ משלוחים בטיפול מיוחד / עיכובים דחופים:*\n`;
    if (stats.criticalIssues.length > 0) {
      stats.criticalIssues.forEach(o => {
        text += `• הזמנה *#${o.orderNumber}* (${o.customerName}) - ${o.notes || 'יש לבדוק דחיפות'} [${o.status === 'pending' ? 'בהמתנה' : 'בטיפול'}]\n`;
      });
    } else {
      text += `_אין חריגות או עיכובים קריטיים הבוקר. הכל זורם כשורה!_\n`;
    }

    text += `\n*📊 אחוז ביצוע יומי:* *${stats.successRate}%*\n\n`;
    text += `_הופק אוטומטית על ידי "Noa AI" - העוזרת הלוגיסטית שלך_`;

    return text;
  }, [stats, currentDateStr, includeFinancials]);

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

          {/* Privacy Switcher */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 mb-5">
            <div className="flex items-start gap-3 justify-between">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 text-slate-600 shrink-0">
                {includeFinancials ? <Unlock className="h-4 w-4 text-emerald-600" /> : <Lock className="h-4 w-4 text-slate-500" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">הצג שווי כספי בדוח</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeFinancials}
                      onChange={(e) => setIncludeFinancials(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  החרגת מידע זה מונעת חשיפת שווי כספי בקבוצות תפעוליות של נהגים ומנהלים פשוטים.
                </p>
              </div>
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
