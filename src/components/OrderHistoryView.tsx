import React, { useState, useMemo } from 'react';
import { AuditLogEntry, Language, OrderStatus, Order } from '../types';
import { translate } from '../utils/api';
import { 
  Search, 
  Filter, 
  Clock, 
  User, 
  FileText, 
  CheckCircle, 
  HelpCircle, 
  ArrowRight, 
  RefreshCw, 
  X,
  ChevronDown,
  ChevronUp,
  Package,
  MapPin,
  Calculator,
  Layers,
  Building,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OrderHistoryViewProps {
  auditLogs: AuditLogEntry[];
  orders: Order[];
  lang: Language;
  onSelectOrderNumber?: (orderNumber: string | null) => void;
  onClearLogs?: () => void;
}

export default function OrderHistoryView({ auditLogs, orders, lang, onSelectOrderNumber, onClearLogs }: OrderHistoryViewProps) {
  const isHe = lang === 'he';
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [operatorFilter, setOperatorFilter] = useState<string>('all');
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  // Toggle log expand state
  const toggleExpand = (logId: string) => {
    setExpandedLogs(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }));
  };

  // Clear filters
  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setOperatorFilter('all');
  };

  // Get unique operators for filter dropdown
  const operators = useMemo(() => {
    const list = new Set<string>();
    auditLogs.forEach(log => {
      if (log.updatedBy) list.add(log.updatedBy);
    });
    return Array.from(list);
  }, [auditLogs]);

  // Filter audit logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchSearch = 
        log.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.updatedBy.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchStatus = statusFilter === 'all' || log.newStatus === statusFilter;
      const matchOperator = operatorFilter === 'all' || log.updatedBy === operatorFilter;

      return matchSearch && matchStatus && matchOperator;
    });
  }, [auditLogs, searchTerm, statusFilter, operatorFilter]);

  // Helper to get status colors and translations
  const getStatusDisplay = (status: OrderStatus | 'created') => {
    switch (status) {
      case 'created':
        return {
          bg: 'bg-slate-50 border-slate-200 text-slate-700',
          textHe: 'הזמנה נוצרה',
          textEn: 'Order Created',
          dot: 'bg-slate-400'
        };
      case 'pending':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-700',
          textHe: 'ממתין לטעינה',
          textEn: 'Awaiting Loading',
          dot: 'bg-amber-500'
        };
      case 'processing':
        return {
          bg: 'bg-blue-50 border-blue-200 text-blue-700',
          textHe: 'בטיפול במחסן',
          textEn: 'Processing',
          dot: 'bg-blue-500'
        };
      case 'delivered':
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
          textHe: 'סופק בהצלחה',
          textEn: 'Delivered',
          dot: 'bg-emerald-500'
        };
      case 'cancelled':
        return {
          bg: 'bg-rose-50 border-rose-200 text-rose-700',
          textHe: 'בוטל במערכת',
          textEn: 'Cancelled',
          dot: 'bg-rose-500'
        };
      default:
        return {
          bg: 'bg-slate-50 border-slate-200 text-slate-700',
          textHe: String(status),
          textEn: String(status),
          dot: 'bg-slate-500'
        };
    }
  };

  const formatLogDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString(isHe ? 'he-IL' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div id="order-history-section" className="space-y-4" dir={isHe ? 'rtl' : 'ltr'}>
      {/* Search & Filter Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800/80 p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 ${isHe ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isHe ? 'חיפוש לפי מספר הזמנה, לקוח, נציג...' : 'Search by order #, customer, agent...'}
              className={`w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs rounded-lg py-2.5 ${isHe ? 'pr-9 pl-4' : 'pl-9 pr-4'} border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all`}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className={`absolute top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 ${isHe ? 'left-2.5' : 'right-2.5'}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Quick Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-700 dark:text-slate-300 outline-none border-none pr-6 pl-1 font-bold cursor-pointer"
              >
                <option value="all" className="dark:bg-slate-900">{isHe ? 'כל הסטטוסים' : 'All Statuses'}</option>
                <option value="pending" className="dark:bg-slate-900">{isHe ? 'ממתין לטעינה' : 'Awaiting Loading'}</option>
                <option value="processing" className="dark:bg-slate-900">{isHe ? 'בטיפול במחסן' : 'Processing'}</option>
                <option value="delivered" className="dark:bg-slate-900">{isHe ? 'סופק בהצלחה' : 'Delivered'}</option>
                <option value="cancelled" className="dark:bg-slate-900">{isHe ? 'בוטלו' : 'Cancelled'}</option>
              </select>
            </div>

            {/* Operator/Agent Filter */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5">
              <User className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
              <select
                value={operatorFilter}
                onChange={(e) => setOperatorFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-700 dark:text-slate-300 outline-none border-none pr-6 pl-1 font-bold cursor-pointer"
              >
                <option value="all" className="dark:bg-slate-900">{isHe ? 'כל המפעילים' : 'All Operators'}</option>
                {operators.map(op => (
                  <option key={op} value={op} className="dark:bg-slate-900">{op}</option>
                ))}
              </select>
            </div>

            {/* Clear filters trigger */}
            {(searchTerm || statusFilter !== 'all' || operatorFilter !== 'all') && (
              <button
                onClick={resetFilters}
                className="text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                {isHe ? 'נקה סינונים' : 'Clear Filters'}
              </button>
            )}

            {/* Total Results badge */}
            <div className="text-[11px] font-black bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-blue-700 dark:text-blue-400 px-2.5 py-1.5 rounded-lg">
              {filteredLogs.length} {isHe ? 'פעולות נמצאו' : 'actions audited'}
            </div>
          </div>

        </div>
      </div>

      {/* Main Audit Timeline View */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm overflow-hidden p-6">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center justify-center">
            <Clock className="h-10 w-10 text-slate-300 dark:text-slate-700 animate-pulse mb-3" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{isHe ? 'לא נמצאו פעולות התואמות את החיפוש' : 'No matching audit records found'}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{isHe ? 'נסה להקל ראש בסינונים או לבחור הזמנה אחרת' : 'Try adjusting your filters or search criteria'}</p>
          </div>
        ) : (
          <div className="relative">
            {/* Real vertical timeline connector line */}
            <div className={`absolute top-3 bottom-3 w-0.5 bg-slate-100 dark:bg-slate-800/80 ${isHe ? 'right-[23px]' : 'left-[23px]'}`} />

            <div className="space-y-6">
              {filteredLogs.map((log) => {
                const displayOld = getStatusDisplay(log.oldStatus);
                const displayNew = getStatusDisplay(log.newStatus);
                const matchingOrder = orders.find(o => o.orderNumber === log.orderNumber || o.id === log.orderId);
                const isExpanded = !!expandedLogs[log.id];

                return (
                  <div key={log.id} className="relative flex items-start gap-4">
                    
                    {/* Circle Timeline Indicator */}
                    <div className="relative z-10 flex items-center justify-center h-12 w-12 rounded-full border-4 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 shrink-0 shadow-sm">
                      <div className={`h-3 w-3 rounded-full ${displayNew.dot} animate-pulse`} />
                    </div>

                    {/* Timeline Bubble Content */}
                    <div className="flex-1 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100/40 dark:hover:bg-slate-800/60 border border-slate-100 dark:border-slate-800/60 hover:border-slate-200/80 dark:hover:border-slate-700/80 rounded-xl p-4 transition-all flex flex-col gap-3 shadow-xs">
                      
                      {/* Main Header Row - Click to toggle */}
                      <div 
                        onClick={() => toggleExpand(log.id)}
                        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 cursor-pointer select-none"
                      >
                        {/* Audit Header Content */}
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Order Number link - clickable to filter Dispatch list! */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectOrderNumber?.(log.orderNumber);
                              }}
                              className="font-mono text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500/20 border border-blue-100 dark:border-blue-900/40 rounded px-2 py-0.5 font-black transition-all cursor-pointer"
                              title={isHe ? 'לחץ כדי להציג את ההזמנה בסידור' : 'Click to highlight in dispatch logs'}
                            >
                              #{log.orderNumber}
                            </button>

                            <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                              {log.customerName}
                            </span>

                            <span className="text-[10px] text-slate-400 dark:text-slate-600">●</span>
                            
                            {/* Operator name */}
                            <div className="flex items-center gap-1 text-[10px] bg-slate-200/50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-bold">
                              <User className="h-2.5 w-2.5 text-slate-400 dark:text-slate-500 shrink-0" />
                              <span>{log.updatedBy}</span>
                            </div>
                          </div>

                          {/* Audit Details text */}
                          <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center flex-wrap gap-2">
                            <span>{isHe ? 'שינוי סטטוס משלוח:' : 'Delivery status changed:'}</span>
                            
                            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${displayOld.bg} dark:bg-opacity-20`}>
                              {isHe ? displayOld.textHe : displayOld.textEn}
                            </span>

                            <ArrowRight className={`h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0 ${isHe ? 'rotate-180' : ''}`} />

                            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-black ${displayNew.bg} dark:bg-opacity-20`}>
                              {isHe ? displayNew.textHe : displayNew.textEn}
                            </span>
                          </div>
                        </div>

                        {/* Right elements: Date & Chevron toggle */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[10px] font-mono">
                            <Clock className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
                            <span>{formatLogDate(log.timestamp)}</span>
                          </div>
                          
                          <div className="h-7 w-7 rounded-lg border border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-xs">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expandable Order Details Downward Panel */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden border-t border-slate-200/60 dark:border-slate-700/60 pt-4 mt-2"
                          >
                            {matchingOrder ? (
                              <div className="space-y-4">
                                {/* Details Card */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white dark:bg-slate-900/55 rounded-xl p-3 border border-slate-100 dark:border-slate-800 shadow-xs text-xs">
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                      <Building className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                      <span className="font-bold">{isHe ? 'מחסן מקור:' : 'Source Warehouse:'}</span>
                                      <span className="font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                                        {matchingOrder.warehouse}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                      <MapPin className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                      <span className="font-bold">{isHe ? 'כתובת אספקה:' : 'Delivery Address:'}</span>
                                      <span className="font-semibold text-slate-900 dark:text-white truncate">
                                        {matchingOrder.deliveryAddress}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                      <Clock className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                                      <span className="font-bold">{isHe ? 'זמן יצירה:' : 'Order Placed:'}</span>
                                      <span className="font-semibold text-slate-900 dark:text-white font-mono">
                                        {formatLogDate(matchingOrder.timestamp)}
                                      </span>
                                    </div>
                                    {matchingOrder.notes && (
                                      <div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                                        <FileText className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                                        <div className="leading-tight">
                                          <span className="font-bold block sm:inline">{isHe ? 'הערות מנהל:' : 'Manager Notes:'}</span>{' '}
                                          <span className="font-medium text-slate-900 dark:text-white italic">{matchingOrder.notes}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Items list & calculations */}
                                <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/40 shadow-xs">
                                  {/* Table Header */}
                                  <div className="bg-slate-100/75 dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-800 grid grid-cols-12 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    <div className="col-span-3">{isHe ? 'מק״ט' : 'SKU'}</div>
                                    <div className="col-span-7">{isHe ? 'שם פריט' : 'Product Name'}</div>
                                    <div className="col-span-2 text-center">{isHe ? 'כמות יח׳' : 'Qty'}</div>
                                  </div>

                                  {/* Table Body */}
                                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                    {matchingOrder.items && matchingOrder.items.length > 0 ? (
                                      matchingOrder.items.map((item, idx) => (
                                        <div 
                                          key={item.id || idx} 
                                          className="px-4 py-2.5 grid grid-cols-12 text-xs items-center hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                                        >
                                          <div className="col-span-3 font-mono text-[10px] text-slate-400 dark:text-slate-500 truncate" title={item.sku}>
                                            {item.sku || 'N/A'}
                                          </div>
                                          <div className="col-span-7 font-bold text-slate-800 dark:text-slate-200 truncate">
                                            {item.name}
                                          </div>
                                          <div className="col-span-2 text-center font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 rounded px-1.5 py-0.5 mx-auto max-w-10">
                                            {item.quantity}
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="p-4 text-center text-xs text-slate-400">
                                        {isHe ? 'לא צוינו פריטים להזמנה זו' : 'No items listed in this order'}
                                      </div>
                                    )}
                                  </div>

                                  {/* Advanced Product Calculation & Summary Row */}
                                  <div className="bg-blue-50/40 dark:bg-blue-950/20 border-t border-blue-100 dark:border-blue-900/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                                    <div className="flex flex-wrap gap-2.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                      <span className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-2 py-1 rounded-lg shadow-2xs">
                                        <Layers className="h-3 w-3 text-blue-500 shrink-0" />
                                        <span>{isHe ? 'מוצרים שונים:' : 'Unique SKUs:'}</span>
                                        <strong className="text-slate-950 dark:text-white font-black">
                                          {matchingOrder.items?.length || 0}
                                        </strong>
                                      </span>
                                      
                                      <span className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-2 py-1 rounded-lg shadow-2xs">
                                        <Calculator className="h-3 w-3 text-emerald-500 shrink-0" />
                                        <span>{isHe ? 'סה״כ יחידות סחורה:' : 'Total Units Count:'}</span>
                                        <strong className="text-emerald-600 dark:text-emerald-400 font-black">
                                          {matchingOrder.items?.reduce((sum, item) => sum + item.quantity, 0) || 0}
                                        </strong>
                                      </span>

                                      {matchingOrder.items && matchingOrder.items.length > 0 && (
                                        <span className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-2 py-1 rounded-lg shadow-2xs">
                                          <Package className="h-3 w-3 text-purple-500 shrink-0" />
                                          <span>{isHe ? 'צפיפות פריט ממוצעת:' : 'Avg Units/SKU:'}</span>
                                          <strong className="text-purple-600 dark:text-purple-400 font-black">
                                            {(() => {
                                              const skus = matchingOrder.items.length;
                                              const total = matchingOrder.items.reduce((sum, item) => sum + item.quantity, 0);
                                              return (total / skus).toFixed(1);
                                            })()}
                                          </strong>
                                        </span>
                                      )}
                                    </div>

                                    {/* Calculated load indicator instead of currency */}
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                                        {isHe ? 'עומס לוגיסטי משוער:' : 'Estimated Cargo Load:'}
                                      </span>
                                      {(() => {
                                        const totalQty = matchingOrder.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
                                        let loadLabel = isHe ? 'קל' : 'Light';
                                        let loadColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
                                        if (totalQty > 15) {
                                          loadLabel = isHe ? 'כבד מאוד' : 'Heavy';
                                          loadColor = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
                                        } else if (totalQty > 6) {
                                          loadLabel = isHe ? 'בינוני' : 'Medium';
                                          loadColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
                                        }
                                        return (
                                          <span className={`text-[11px] font-black border rounded-lg px-2.5 py-1 ${loadColor}`}>
                                            {loadLabel}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 rounded-xl text-xs text-amber-700 dark:text-amber-400">
                                <Info className="h-4 w-4 shrink-0" />
                                <span>
                                  {isHe 
                                    ? 'לא נמצאו נתוני הזמנה מפורטים בסינכרון הנוכחי עבור הזמנה זו.' 
                                    : 'Detailed order items could not be resolved for this historical log.'}
                                </span>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
