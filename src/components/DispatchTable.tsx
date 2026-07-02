import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Building2, 
  MapPin, 
  Clock, 
  User, 
  Package, 
  ArrowUpDown, 
  ArrowUp,
  ArrowDown,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Calendar,
  Filter,
  X,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { Order, OrderStatus, Language, AuditLogEntry } from '../types';
import { translate, formatDate, MOCK_PRODUCTS } from '../utils/api';
import { motion } from 'motion/react';

interface DispatchTableProps {
  orders: Order[];
  auditLogs?: AuditLogEntry[];
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onDeleteOrder?: (orderId: string) => void;
  lang: Language;
  isLoading: boolean;
  selectedOrderNumber?: string | null;
  onSelectOrderNumber?: (orderNumber: string | null) => void;
}

type SortField = 'timestamp' | 'totalAmount' | 'customerName' | 'orderNumber' | 'predictedDelay' | 'status';
type SortOrder = 'asc' | 'desc';

export default function DispatchTable({
  orders,
  auditLogs,
  onUpdateStatus,
  onDeleteOrder,
  lang,
  isLoading,
  selectedOrderNumber,
  onSelectOrderNumber,
}: DispatchTableProps) {
  const isHe = lang === 'he';

  // State for filtering/sorting
  const [searchTerm, setSearchTerm] = useState(() => {
    try {
      return localStorage.getItem('dispatch_searchTerm') || '';
    } catch {
      return '';
    }
  });
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(() => {
    try {
      return localStorage.getItem('dispatch_selectedWarehouse') || 'all';
    } catch {
      return 'all';
    }
  });
  const [selectedStatus, setSelectedStatus] = useState<string>(() => {
    try {
      return localStorage.getItem('dispatch_selectedStatus') || 'all';
    } catch {
      return 'all';
    }
  });
  const [startDate, setStartDate] = useState<string>(() => {
    try {
      return localStorage.getItem('dispatch_startDate') || '';
    } catch {
      return '';
    }
  });
  const [endDate, setEndDate] = useState<string>(() => {
    try {
      return localStorage.getItem('dispatch_endDate') || '';
    } catch {
      return '';
    }
  });
  const [selectedSku, setSelectedSku] = useState<string>(() => {
    try {
      return localStorage.getItem('dispatch_selectedSku') || 'all';
    } catch {
      return 'all';
    }
  });
  
  const [sortField, setSortField] = useState<SortField>(() => {
    try {
      return (localStorage.getItem('dispatch_sortField') as SortField) || 'timestamp';
    } catch {
      return 'timestamp';
    }
  });
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    try {
      return (localStorage.getItem('dispatch_sortOrder') as SortOrder) || 'desc';
    } catch {
      return 'desc';
    }
  });

  // Sync state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('dispatch_searchTerm', searchTerm);
    } catch (e) {
      console.error(e);
    }
  }, [searchTerm]);

  useEffect(() => {
    try {
      localStorage.setItem('dispatch_selectedWarehouse', selectedWarehouse);
    } catch (e) {
      console.error(e);
    }
  }, [selectedWarehouse]);

  useEffect(() => {
    try {
      localStorage.setItem('dispatch_selectedStatus', selectedStatus);
    } catch (e) {
      console.error(e);
    }
  }, [selectedStatus]);

  useEffect(() => {
    try {
      localStorage.setItem('dispatch_startDate', startDate);
    } catch (e) {
      console.error(e);
    }
  }, [startDate]);

  useEffect(() => {
    try {
      localStorage.setItem('dispatch_endDate', endDate);
    } catch (e) {
      console.error(e);
    }
  }, [endDate]);

  useEffect(() => {
    try {
      localStorage.setItem('dispatch_selectedSku', selectedSku);
    } catch (e) {
      console.error(e);
    }
  }, [selectedSku]);

  useEffect(() => {
    try {
      localStorage.setItem('dispatch_sortField', sortField);
    } catch (e) {
      console.error(e);
    }
  }, [sortField]);

  useEffect(() => {
    try {
      localStorage.setItem('dispatch_sortOrder', sortOrder);
    } catch (e) {
      console.error(e);
    }
  }, [sortOrder]);
  
  // Expanded rows track
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // Selected orders track for bulk update
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  
  // Hovered order state for detailed summary tooltip
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null);
  const [mouseCoords, setMouseCoords] = useState({ x: 0, y: 0 });

  // Compile list of unique SKUs for filters from products and orders
  const uniqueSkus = useMemo(() => {
    const map = new Map<string, string>();
    // Pre-populate with our standard products
    MOCK_PRODUCTS.forEach(p => {
      map.set(p.sku, p.name);
    });
    // Add any from current orders to be fully dynamic
    orders.forEach(o => {
      (o.items || []).forEach(item => {
        if (item.sku && !map.has(item.sku)) {
          map.set(item.sku, item.name);
        }
      });
    });
    return Array.from(map.entries()).map(([sku, name]) => ({ sku, name }));
  }, [orders]);

  // Get unique warehouses for filters
  const uniqueWarehouses = ['all', ...Array.from(new Set(orders.map(o => o.warehouse).filter(Boolean)))];

  // Helper to extract city from address
  const getCityFromAddress = (address: string): string => {
    if (!address) return 'אחר';
    const knownCities = ['תל אביב', 'ירושלים', 'חיפה', 'אשדוד', 'באר שבע', 'מודיעין', 'ראשון לציון', 'חולון'];
    for (const city of knownCities) {
      if (address.includes(city)) return city;
    }
    const englishCities: Record<string, string> = {
      'tel aviv': 'תל אביב',
      'jerusalem': 'ירושלים',
      'haifa': 'חיפה',
      'ashdod': 'אשדוד',
      'beer sheva': 'באר שבע',
      'modiin': 'מודיעין',
      'rishon lezion': 'ראשון לציון',
      'holon': 'חולון'
    };
    const lowerAddress = address.toLowerCase();
    for (const [eng, heb] of Object.entries(englishCities)) {
      if (lowerAddress.includes(eng)) return heb;
    }
    return 'אחר';
  };

  // Operational Time Analysis and SLA Breach Risk Engine
  const orderDelayMetrics = useMemo(() => {
    const metricsMap: Record<string, {
      standardProcessingTime: number;
      slaWindow: number;
      elapsedHours: number;
      riskScore: number;
      riskCategory: 'breached' | 'high' | 'medium' | 'safe' | 'delivered' | 'cancelled';
      reasonHe: string;
      reasonEn: string;
    }> = {};

    // Compute active load queues per warehouse to factor into queue delay
    const queueCounts: Record<string, number> = {};
    orders.forEach(o => {
      if (o.status === 'pending' || o.status === 'processing') {
        const wh = o.warehouse || '';
        queueCounts[wh] = (queueCounts[wh] || 0) + 1;
      }
    });

    orders.forEach(order => {
      if (order.status === 'cancelled') {
        metricsMap[order.id] = {
          standardProcessingTime: 0,
          slaWindow: 0,
          elapsedHours: 0,
          riskScore: 0,
          riskCategory: 'cancelled',
          reasonHe: 'בוטל על ידי המשלח',
          reasonEn: 'Cancelled by dispatcher'
        };
        return;
      }

      if (order.status === 'delivered') {
        metricsMap[order.id] = {
          standardProcessingTime: 0,
          slaWindow: 0,
          elapsedHours: 0,
          riskScore: 0,
          riskCategory: 'delivered',
          reasonHe: 'נמסר ליעד בהצלחה',
          reasonEn: 'Delivered successfully'
        };
        return;
      }

      // 1. Standard Processing Duration based on warehouse, load, items, and volume
      let baseRate = 2.5; // base standard handling hours
      const wh = order.warehouse || '';
      const isCharash = wh.includes('החרש') || wh.toLowerCase().includes('charash');
      const isTalmid = wh.includes('התלמיד') || wh.toLowerCase().includes('talmid');
      
      if (isCharash) baseRate = 2.0; // High-efficiency automatic wrap
      else if (isTalmid) baseRate = 3.5; // Heavier industrial cargo

      const queueCount = queueCounts[wh] || 0;
      const itemTypesCount = order.items?.length || 0;
      const totalUnits = order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;

      // Statistical Duration Formula (Hours)
      const standardProcessingTime = baseRate + (queueCount * 0.25) + (itemTypesCount * 0.35) + (totalUnits * 0.015);

      // 2. SLA Commitment Window (Hours) based on distance/location
      const city = getCityFromAddress(order.deliveryAddress);
      let slaWindow = 18; // Standard default window
      if (['תל אביב', 'חולון', 'ראשון לציון', 'מודיעין'].includes(city)) {
        slaWindow = 12; // Local metro area
      } else if (['ירושלים', 'חיפה', 'אשדוד', 'באר שבע'].includes(city)) {
        slaWindow = 24; // Outlying districts
      }

      // 3. Operational Elapsed Duration (simulate with respect to 2026-06-29 current time if possible, or live Date.now())
      const orderTime = new Date(order.timestamp).getTime();
      const elapsedMs = Date.now() - orderTime;
      const elapsedHours = Math.max(0, elapsedMs / (1000 * 60 * 60));

      // 4. Probability Score & Classification
      const riskScore = Math.round((elapsedHours / slaWindow) * 100);

      let riskCategory: 'breached' | 'high' | 'medium' | 'safe' = 'safe';
      if (elapsedHours > slaWindow) {
        riskCategory = 'breached';
      } else if (elapsedHours / slaWindow >= 0.75) {
        riskCategory = 'high';
      } else if (elapsedHours / slaWindow >= 0.40) {
        riskCategory = 'medium';
      }

      // 5. Narrative Explanation of Bottlenecks
      let reasonHe = '';
      let reasonEn = '';

      if (riskCategory === 'breached') {
        const overBy = (elapsedHours - slaWindow).toFixed(1);
        reasonHe = `חריגת SLA של ${overBy} שעות`;
        reasonEn = `SLA breached by ${overBy} hrs`;
      } else {
        const partsHe = [];
        const partsEn = [];
        if (isTalmid) {
          partsHe.push('מחסן התלמיד (עמוס)');
          partsEn.push('Talmid Hub load');
        }
        if (queueCount > 3) {
          partsHe.push('תור משלוחים ארוך');
          partsEn.push('Queue delays');
        }
        if (totalUnits > 40) {
          partsHe.push('נפח פריטים חריג');
          partsEn.push('High pallet volume');
        }

        if (partsHe.length > 0) {
          reasonHe = partsHe.join(' + ');
          reasonEn = partsEn.join(' + ');
        } else {
          reasonHe = 'זמני טיפול תקינים';
          reasonEn = 'Nominal transit times';
        }
      }

      metricsMap[order.id] = {
        standardProcessingTime: Math.round(standardProcessingTime * 10) / 10,
        slaWindow,
        elapsedHours: Math.round(elapsedHours * 10) / 10,
        riskScore,
        riskCategory,
        reasonHe,
        reasonEn
      };
    });

    return metricsMap;
  }, [orders]);

  // Local date helper functions (prevent timezone-shifts)
  const getLocalTodayStr = (): string => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getLocalOffsetDateStr = (daysOffset: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getLocalSundayStr = (): string => {
    const d = new Date();
    const dayOfWeek = d.getDay();
    d.setDate(d.getDate() - dayOfWeek);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getLocalFirstDayOfMonthStr = (): string => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  };

  // Predefined date preset handler
  const handleDatePreset = (preset: 'all' | 'today' | 'yesterday' | 'thisWeek' | '7days' | 'thisMonth' | '30days') => {
    const todayStr = getLocalTodayStr();
    
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const yesterdayStr = getLocalOffsetDateStr(-1);
      setStartDate(yesterdayStr);
      setEndDate(yesterdayStr);
    } else if (preset === 'thisWeek') {
      const sundayStr = getLocalSundayStr();
      setStartDate(sundayStr);
      setEndDate(todayStr);
    } else if (preset === '7days') {
      const pastStr = getLocalOffsetDateStr(-6);
      setStartDate(pastStr);
      setEndDate(todayStr);
    } else if (preset === 'thisMonth') {
      const firstOfMonthStr = getLocalFirstDayOfMonthStr();
      setStartDate(firstOfMonthStr);
      setEndDate(todayStr);
    } else if (preset === '30days') {
      const pastStr = getLocalOffsetDateStr(-29);
      setStartDate(pastStr);
      setEndDate(todayStr);
    }
  };

  const getActivePreset = (): 'all' | 'today' | 'yesterday' | 'thisWeek' | '7days' | 'thisMonth' | '30days' | 'custom' => {
    const todayStr = getLocalTodayStr();
    if (!startDate && !endDate) return 'all';
    if (startDate === todayStr && endDate === todayStr) return 'today';
    
    const yesterdayStr = getLocalOffsetDateStr(-1);
    if (startDate === yesterdayStr && endDate === yesterdayStr) return 'yesterday';
    
    const sundayStr = getLocalSundayStr();
    if (startDate === sundayStr && endDate === todayStr) return 'thisWeek';
    
    const past7Str = getLocalOffsetDateStr(-6);
    if (startDate === past7Str && endDate === todayStr) return '7days';
    
    const firstOfMonthStr = getLocalFirstDayOfMonthStr();
    if (startDate === firstOfMonthStr && endDate === todayStr) return 'thisMonth';
    
    const past30Str = getLocalOffsetDateStr(-29);
    if (startDate === past30Str && endDate === todayStr) return '30days';
    
    return 'custom';
  };

  // Clear all filters
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedWarehouse('all');
    setSelectedStatus('all');
    setStartDate('');
    setEndDate('');
    setSelectedSku('all');
    onSelectOrderNumber?.(null);
  };

  // Toggle row expansion
  const toggleRow = (id: string) => {
    setExpandedOrders(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Toggle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Filter & Sort logic
  const filteredOrders = orders
    .filter(order => {
      // If a specific order is selected from the map, show ONLY that order!
      if (selectedOrderNumber) {
        return order.orderNumber === selectedOrderNumber;
      }

      const orderNumber = order.orderNumber || '';
      const customerName = order.customerName || '';
      const deliveryAddress = order.deliveryAddress || '';

      const matchSearch = 
        orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        translate(customerName, 'en').toLowerCase().includes(searchTerm.toLowerCase()) ||
        deliveryAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
        translate(deliveryAddress, 'en').toLowerCase().includes(searchTerm.toLowerCase());
        
      const matchWarehouse = selectedWarehouse === 'all' || order.warehouse === selectedWarehouse;
      const matchStatus = selectedStatus === 'all' || order.status === selectedStatus;

      // Date Range Match
      let matchDate = true;
      const orderTime = new Date(order.timestamp).getTime();
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (orderTime < start.getTime()) matchDate = false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (orderTime > end.getTime()) matchDate = false;
      }

      // SKU Specific Match
      let matchSku = true;
      if (selectedSku !== 'all') {
        matchSku = (order.items || []).some(item => item.sku === selectedSku);
      }

      return matchSearch && matchWarehouse && matchStatus && matchDate && matchSku;
    })
    .sort((a, b) => {
      if (sortField === 'predictedDelay') {
        const scoreA = orderDelayMetrics[a.id]?.riskScore || 0;
        const scoreB = orderDelayMetrics[b.id]?.riskScore || 0;
        return sortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
      }

      let aVal: any = a[sortField as any];
      let bVal: any = b[sortField as any];

      // Format custom string comparisons
      if (sortField === 'timestamp') {
        aVal = new Date(a.timestamp).getTime();
        bVal = new Date(b.timestamp).getTime();
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal, isHe ? 'he' : 'en')
          : bVal.localeCompare(aVal, isHe ? 'he' : 'en');
      } else {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });

  // Render predicted delay badge
  const renderDelayFlag = (orderId: string) => {
    const data = orderDelayMetrics[orderId];
    if (!data) return null;

    const { riskCategory, riskScore, reasonHe, reasonEn } = data;
    const reason = isHe ? reasonHe : reasonEn;

    let badgeClass = '';
    let text = '';
    let dotClass = '';

    if (riskCategory === 'cancelled') {
      badgeClass = 'bg-slate-50 text-slate-400 border-slate-200';
      text = isHe ? 'בוטל' : 'Cancelled';
      dotClass = 'bg-slate-300';
    } else if (riskCategory === 'delivered') {
      badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      text = isHe ? 'הושלם ב-SLA' : 'SLA Met';
      dotClass = 'bg-emerald-500';
    } else if (riskCategory === 'breached') {
      badgeClass = 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse';
      text = isHe ? 'חריגת SLA!' : 'SLA Breached!';
      dotClass = 'bg-rose-600';
    } else if (riskCategory === 'high') {
      badgeClass = 'bg-orange-50 text-orange-700 border-orange-200';
      text = isHe ? 'סיכון גבוה' : 'High Risk';
      dotClass = 'bg-orange-500';
    } else if (riskCategory === 'medium') {
      badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
      text = isHe ? 'סיכון בינוני' : 'Medium Risk';
      dotClass = 'bg-amber-500';
    } else {
      badgeClass = 'bg-blue-50/70 text-blue-700 border-blue-200/50';
      text = isHe ? 'תקין (בזמן)' : 'On Track';
      dotClass = 'bg-blue-500';
    }

    return (
      <div className="inline-flex flex-col items-center gap-0.5 group/delay relative cursor-help">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${badgeClass}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
          <span>{text}</span>
          {riskCategory !== 'cancelled' && riskCategory !== 'delivered' && (
            <span className="font-mono text-[9px] opacity-80">({riskScore}%)</span>
          )}
        </span>
        <span className="text-[10px] text-slate-400 max-w-[125px] truncate font-medium block">
          {reason}
        </span>

        {/* Dynamic micro-tooltip overlay on hover */}
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-xl p-3 shadow-xl opacity-0 group-hover/delay:opacity-100 pointer-events-none transition-opacity duration-200 z-50 text-left text-[11px] w-56 space-y-1.5 border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1 font-bold">
            <span className="text-blue-400">{isHe ? 'ניתוח עמידה ב-SLA' : 'SLA Analytics'}</span>
            <span className="font-mono">{riskScore}%</span>
          </div>
          {riskCategory !== 'cancelled' && riskCategory !== 'delivered' ? (
            <>
              <div className="flex justify-between">
                <span className="text-slate-400">{isHe ? 'זמן טיפול צפוי:' : 'Expected Std:'}</span>
                <span className="font-mono text-white font-bold">{data.standardProcessingTime}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{isHe ? 'זמן מהקליטה:' : 'Elapsed Time:'}</span>
                <span className="font-mono text-white font-bold">{data.elapsedHours}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{isHe ? 'חלון SLA מוגדר:' : 'SLA Window:'}</span>
                <span className="font-mono text-white font-bold">{data.slaWindow}h</span>
              </div>
            </>
          ) : null}
          <div className="text-[10px] text-slate-400 border-t border-slate-800/60 pt-1 leading-normal font-medium">
            <span className="font-bold text-slate-300">{isHe ? 'גורמי השפעה:' : 'Factors:'}</span> {reason}
          </div>
        </div>
      </div>
    );
  };

  // Render Status Badge
  const renderStatusBadge = (order: Order) => {
    const rawStatus = order.status || 'pending';
    const statusMap = {
      pending: {
        bg: 'bg-amber-50/90 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50',
        textHe: 'חדש',
        textEn: 'Pending',
      },
      processing: {
        bg: 'bg-blue-50/90 text-blue-800 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50',
        textHe: 'בטיפול',
        textEn: 'Processing',
      },
      delivered: {
        bg: 'bg-emerald-50/90 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50',
        textHe: 'נמסר',
        textEn: 'Delivered',
      },
      cancelled: {
        bg: 'bg-rose-50/90 text-rose-800 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50',
        textHe: 'בוטל',
        textEn: 'Cancelled',
      },
    };
    const normStatus = (rawStatus.toLowerCase().trim() as OrderStatus);
    const config = statusMap[normStatus] || statusMap.pending;

    // Find last status change timestamp from auditLogs
    const matchingLogs = auditLogs?.filter(log => log.orderId === order.id && log.newStatus === normStatus) || [];
    const lastLog = matchingLogs[0]; // auditLogs are already sorted descending in api.ts
    const changeTimestamp = lastLog ? lastLog.timestamp : order.timestamp;
    
    // Format timestamp
    const formattedTime = formatDate(changeTimestamp, lang);

    return (
      <div className="relative group/status inline-block cursor-help">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${config.bg}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
          {isHe ? config.textHe : config.textEn}
        </span>
        
        {/* Status Change Tooltip */}
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-950 text-white rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover/status:opacity-100 pointer-events-none transition-opacity duration-200 z-50 text-center text-[11px] whitespace-nowrap border border-slate-800">
          <p className="font-bold text-indigo-400 mb-0.5">
            {isHe ? 'עדכון סטטוס אחרון:' : 'Last Status Update:'}
          </p>
          <p className="font-mono font-medium text-slate-200">
            {formattedTime}
          </p>
          {lastLog?.updatedBy && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              {isHe ? `עודכן על ידי: ${translate(lastLog.updatedBy, lang)}` : `Updated by: ${lastLog.updatedBy}`}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Advanced Floating Search and Filters Panel */}
      <div className="rounded-2xl border border-slate-200/60 bg-white/95 backdrop-blur-md p-6 shadow-md shadow-slate-100/80 hover:shadow-lg transition-all space-y-5 relative z-20">
        
        {/* Row 1: Header, Search and Reset */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-50 text-blue-600 p-2 rounded-xl border border-blue-100">
              <Filter className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {isHe ? 'סרגל סינון ואיתור מתקדם' : 'Advanced Dispatch Filters'}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isHe ? 'סינון ואיתור נתונים בזמן אמת לפי יעדים, מלאי ותאריכים' : 'Filter and query live dispatches by location, SKU, and date'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {selectedOrderNumber && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-1.5 rounded-lg animate-pulse">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>{isHe ? 'סינון פעיל מהמפה:' : 'Map Filter Active:'} <strong>#{selectedOrderNumber}</strong></span>
                <button
                  onClick={() => onSelectOrderNumber?.(null)}
                  className="bg-amber-100 hover:bg-amber-200 text-amber-950 px-2 py-0.5 rounded text-[10px] font-black cursor-pointer transition-colors"
                >
                  {isHe ? 'בטל סינון' : 'Clear'}
                </button>
              </div>
            )}

            {/* Results count badge */}
            <div className="flex items-center gap-1.5 text-xs font-bold bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-slate-500">
              <span>{isHe ? 'הזמנות שנמצאו:' : 'Matches:'}</span>
              <span className="font-mono text-blue-600 bg-blue-50/50 rounded px-1.5 py-0.5 text-xs">{filteredOrders.length}</span>
              <span className="text-slate-300">/</span>
              <span className="font-mono text-slate-600">{orders.length}</span>
            </div>

            {/* Clear Filters Button */}
            {(searchTerm || selectedWarehouse !== 'all' || selectedStatus !== 'all' || startDate || endDate || selectedSku !== 'all' || selectedOrderNumber) && (
              <button
                id="dispatch-reset-filters-btn"
                onClick={resetFilters}
                className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-all cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>{isHe ? 'איפוס מסננים' : 'Clear Filters'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Grid of Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          
          {/* 1. Global Search input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Search className="h-3 w-3" />
              {isHe ? 'חיפוש חופשי' : 'Free Search'}
            </label>
            <div className="relative">
              <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 ${isHe ? 'right-3' : 'left-3'}`} />
              <input
                id="dispatch-search-input"
                type="text"
                placeholder={isHe ? 'מספר הזמנה, שם לקוח, כתובת...' : 'Order #, customer, address...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full rounded-xl border border-slate-200 bg-slate-50/40 py-2 text-xs outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50/50 ${
                  isHe ? 'pl-4 pr-9 text-right' : 'pl-9 pr-4 text-left'
                }`}
              />
            </div>
          </div>

          {/* 2. Warehouse Picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {isHe ? 'מחסן הפצה' : 'Warehouse Hub'}
            </label>
            <select
              id="filter-warehouse-select"
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/40 py-2 px-3 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50/50"
            >
              <option value="all">{isHe ? 'כל המחסנים (הכל)' : 'All Warehouses'}</option>
              {/* Ensure "מחסן התלמיד" and "מחסן החרש" are prominent if they exist in standard list */}
              {uniqueWarehouses.filter(w => w !== 'all').map(wh => (
                <option key={wh} value={wh}>
                  {translate(wh, lang)}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Specific SKU/Product Search Lookup */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Package className="h-3 w-3" />
              {isHe ? 'איתור לפי מק"ט / פריט' : 'Filter by SKU / Item'}
            </label>
            <select
              id="filter-sku-select"
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/40 py-2 px-3 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50/50"
            >
              <option value="all">{isHe ? 'כל המק"טים (הכל)' : 'All Products / SKUs'}</option>
              {uniqueSkus.map(item => (
                <option key={item.sku} value={item.sku}>
                  {item.sku} - {translate(item.name, lang)}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Date Range Picking */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-blue-500" />
              {isHe ? 'סינון תאריכים מותאם אישית' : 'Custom Date Range'}
            </label>
            <div className="flex items-center gap-1.5 bg-white/80 rounded-xl border border-slate-200 p-1 shadow-xs transition-all hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-50/50">
              <input
                id="filter-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-transparent py-0.5 px-1.5 text-[11px] font-semibold text-slate-700 outline-none cursor-pointer"
                title={isHe ? 'תאריך התחלה' : 'Start Date'}
              />
              <span className="text-slate-400 text-xs font-bold font-mono">←</span>
              <input
                id="filter-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-transparent py-0.5 px-1.5 text-[11px] font-semibold text-slate-700 outline-none cursor-pointer"
                title={isHe ? 'תאריך סיום' : 'End Date'}
              />
            </div>
            {/* Range feedback badge */}
            <div className="flex items-center gap-1 text-[9.5px] text-slate-500 font-bold bg-slate-50/80 border border-slate-200/50 rounded-lg px-2 py-0.5 w-full justify-between">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                <span>
                  {isHe 
                    ? `טווח פעיל: ${startDate ? formatDate(startDate, lang) : 'התחלה'} ➔ ${endDate ? formatDate(endDate, lang) : 'היום'}` 
                    : `Active: ${startDate ? formatDate(startDate, lang) : 'Start'} ➔ ${endDate ? formatDate(endDate, lang) : 'Today'}`}
                </span>
              </span>
              <span className="font-mono bg-blue-50/80 text-blue-600 px-1 rounded">
                {filteredOrders.length}
              </span>
            </div>
          </div>

        </div>

        {/* Row 3: Quick Date Presets and Status segments */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-3 border-t border-slate-100">
          
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
              {isHe ? 'טווחים מהירים:' : 'Quick Presets:'}
            </span>
            <div className="flex flex-wrap gap-1">
              {[
                { id: 'all', he: 'כל הזמנים', en: 'All' },
                { id: 'today', he: 'היום', en: 'Today' },
                { id: 'yesterday', he: 'אתמול', en: 'Yesterday' },
                { id: 'thisWeek', he: 'השבוע (א-ש)', en: 'This Week' },
                { id: '7days', he: '7 ימים אחרונים', en: 'Last 7 Days' },
                { id: 'thisMonth', he: 'החודש הנוכחי', en: 'This Month' },
                { id: '30days', he: '30 ימים אחרונים', en: 'Last 30 Days' },
              ].map((p) => {
                const isActive = getActivePreset() === p.id;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleDatePreset(p.id as any)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-all duration-200 ease-out gpu-scale-hover hover-border-inset touch-active-state cursor-pointer shadow-xs ${
                      isActive
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-102 font-black'
                        : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {isHe ? p.he : p.en}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Segment Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
              {isHe ? 'סינון לפי סטטוס:' : 'Status Filter:'}
            </span>
            <div className="flex gap-0.5 bg-slate-100 p-1 rounded-xl border border-slate-200/40">
              {['all', 'pending', 'processing', 'delivered', 'cancelled'].map((status) => {
                const label = {
                  all: isHe ? 'הכל' : 'All',
                  pending: isHe ? 'חדש' : 'Pending',
                  processing: isHe ? 'בטיפול' : 'In Progress',
                  delivered: isHe ? 'נמסר' : 'Delivered',
                  cancelled: isHe ? 'בוטל' : 'Cancelled',
                }[status];
                
                const isActive = selectedStatus === status;
                return (
                  <button
                    key={status}
                    type="button"
                    id={`filter-status-${status}-btn`}
                    onClick={() => setSelectedStatus(status)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                      isActive 
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/10 font-black' 
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* Main Table Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        
        {/* Quick-filter status pill buttons */}
        <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
              {isHe ? 'סינון מהיר:' : 'Quick Filter:'}
            </span>
            {[
              { id: 'all', labelHe: 'הכל', labelEn: 'All', count: orders.length, color: 'blue' },
              { id: 'pending', labelHe: 'חדש', labelEn: 'Pending', count: orders.filter(o => o.status === 'pending').length, color: 'amber' },
              { id: 'processing', labelHe: 'בטיפול', labelEn: 'In-Transit', count: orders.filter(o => o.status === 'processing').length, color: 'blue' },
              { id: 'delivered', labelHe: 'נמסר', labelEn: 'Delivered', count: orders.filter(o => o.status === 'delivered').length, color: 'emerald' }
            ].map(pill => {
              const isActive = selectedStatus === pill.id;
              
              let activeClass = '';
              let inactiveClass = 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50 hover:text-slate-900';
              
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
                  onClick={() => setSelectedStatus(pill.id)}
                  className={`rounded-full px-3.5 py-1 text-xs font-bold border flex items-center gap-2 transition-all duration-200 ease-out gpu-scale-hover hover-border-inset touch-active-state cursor-pointer ${
                    isActive ? activeClass : inactiveClass
                  }`}
                >
                  <span>{isHe ? pill.labelHe : pill.labelEn}</span>
                  <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-bold font-mono transition-colors ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {pill.count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="text-[10px] text-slate-400 font-bold hidden sm:block">
            {isHe 
              ? `מציג ${filteredOrders.length} מתוך ${orders.length} הזמנות` 
              : `Showing ${filteredOrders.length} of ${orders.length} orders`}
          </div>
        </div>

        {/* Real-time search input above the dispatch table OR Bulk Action Bar if items selected */}
        <div className="border-b border-slate-100 bg-slate-50/40 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-h-[56px]">
          {selectedOrderIds.length > 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap items-center justify-between w-full gap-3 bg-indigo-50/40 px-3 py-1.5 rounded-xl border border-indigo-100/50"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-bold text-indigo-900">
                  {isHe 
                    ? `נבחרו ${selectedOrderIds.length} משלוחים` 
                    : `${selectedOrderIds.length} orders selected`}
                </span>
                <button
                  onClick={() => setSelectedOrderIds([])}
                  className="text-xs text-indigo-500 hover:text-indigo-700 underline cursor-pointer"
                >
                  {isHe ? 'ביטול בחירה' : 'Clear selection'}
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">
                  {isHe ? 'עדכון סטטוס קבוצתי:' : 'Bulk status update:'}
                </span>
                <div className="flex gap-1.5">
                  {(['pending', 'processing', 'delivered', 'cancelled'] as OrderStatus[]).map((st) => {
                    let btnColor = 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/50';
                    if (st === 'pending') btnColor = 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200/50';
                    if (st === 'processing') btnColor = 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200/50';
                    if (st === 'delivered') btnColor = 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200/50';
                    if (st === 'cancelled') btnColor = 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200/50';
                    
                    const label = isHe 
                      ? (st === 'pending' ? 'חדש' : st === 'processing' ? 'בטיפול' : st === 'delivered' ? 'נמסר' : 'בוטל')
                      : (st === 'pending' ? 'Pending' : st === 'processing' ? 'Processing' : st === 'delivered' ? 'Delivered' : 'Cancelled');
                      
                    return (
                      <button
                        key={st}
                        onClick={() => {
                          selectedOrderIds.forEach(id => {
                            onUpdateStatus(id, st);
                          });
                          setSelectedOrderIds([]);
                        }}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all duration-200 ease-out gpu-scale-hover hover-border-inset touch-active-state border ${btnColor} hover:scale-102 cursor-pointer shadow-xs`}
                        id={`bulk-status-${st}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {isHe ? 'רשימת משלוחים וסטטוס קווים' : 'Active Dispatches & Route Status'}
                </h4>
              </div>
              
              <div className="relative w-full sm:w-80">
                <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 ${isHe ? 'right-3' : 'left-3'}`} />
                <input
                  id="dispatch-table-quick-search"
                  type="text"
                  placeholder={isHe ? 'חפש לפי שם לקוח או מספר הזמנה...' : 'Search by name or order #...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full rounded-xl border border-slate-200 bg-white py-1.5 text-xs outline-none font-medium transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100/50 shadow-xs ${
                    isHe ? 'pl-8 pr-9 text-right' : 'pl-9 pr-8 text-left'
                  }`}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer rounded-full hover:bg-slate-100 ${
                      isHe ? 'left-2.5' : 'right-2.5'
                    }`}
                    title={isHe ? 'נקה חיפוש' : 'Clear search'}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        
        {isLoading ? (
          <div className="overflow-x-auto animate-pulse">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4 w-10"></th>
                  <th className="py-3.5 px-4">{isHe ? 'מספר הזמנה' : 'Order #'}</th>
                  <th className="py-3.5 px-4">{isHe ? 'תאריך ושעה' : 'Timestamp'}</th>
                  <th className="py-3.5 px-4">{isHe ? 'לקוח קצה' : 'Customer Name'}</th>
                  <th className="py-3.5 px-4">{isHe ? 'מחסן' : 'Warehouse'}</th>
                  <th className="py-3.5 px-4">{isHe ? 'סטטוס' : 'Fulfillment Status'}</th>
                  <th className="py-3.5 px-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[1, 2, 3, 4, 5].map((idx) => (
                  <tr key={idx} className="hover:bg-slate-50/30">
                    <td className="py-4 px-4">
                      <div className="h-4 w-4 rounded bg-slate-200" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-20 rounded bg-slate-200" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-24 rounded bg-slate-100" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-1.5">
                        <div className="h-4 w-32 rounded bg-slate-200" />
                        <div className="h-3 w-40 rounded bg-slate-100" />
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-5 w-24 rounded bg-slate-100" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-6 w-16 rounded bg-slate-100" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-8 w-8 rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="rounded-full bg-slate-50 p-4 border border-slate-100 mb-3">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
            <h4 className="text-sm font-bold text-slate-700">
              {isHe ? 'לא נמצאו הזמנות תואמות' : 'No matching dispatches found'}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              {isHe 
                ? 'נסה לשנות את ביטוי החיפוש או לאפס את המסננים שהגדרת' 
                : 'Try adjusting your filters, searching other metrics, or generating a mock order.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4 w-10"></th>
                  <th className="py-3 px-2 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredOrders.length > 0 && filteredOrders.every(o => selectedOrderIds.includes(o.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOrderIds(prev => {
                            const newIds = [...prev];
                            filteredOrders.forEach(o => {
                              if (!newIds.includes(o.id)) newIds.push(o.id);
                            });
                            return newIds;
                          });
                        } else {
                          setSelectedOrderIds(prev => prev.filter(id => !filteredOrders.some(o => o.id === id)));
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>
                  <th 
                    className="py-3 px-4 cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => handleSort('orderNumber')}
                  >
                    <div className="flex items-center gap-1">
                      <span className={sortField === 'orderNumber' ? 'text-indigo-600 font-bold' : ''}>
                        {isHe ? 'מספר הזמנה' : 'Order #'}
                      </span>
                      {sortField === 'orderNumber' ? (
                        sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-300" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="py-3 px-4 cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => handleSort('timestamp')}
                  >
                    <div className="flex items-center gap-1">
                      <span className={sortField === 'timestamp' ? 'text-indigo-600 font-bold' : ''}>
                        {isHe ? 'תאריך ושעה' : 'Timestamp'}
                      </span>
                      {sortField === 'timestamp' ? (
                        sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-300" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="py-3 px-4 cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => handleSort('customerName')}
                  >
                    <div className="flex items-center gap-1">
                      <span className={sortField === 'customerName' ? 'text-indigo-600 font-bold' : ''}>
                        {isHe ? 'שם לקוח' : 'Customer Name'}
                      </span>
                      {sortField === 'customerName' ? (
                        sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-300" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-4">{isHe ? 'מחסן הפצה' : 'Warehouse'}</th>
                  <th className="py-3 px-4">{isHe ? 'כתובת אספקה' : 'Delivery Address'}</th>
                  <th 
                    className="py-3 px-4 text-center cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => handleSort('predictedDelay')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span className={sortField === 'predictedDelay' ? 'text-indigo-600 font-bold' : ''}>
                        {isHe ? 'צפי עיכוב / סיכון SLA' : 'SLA Breach Risk'}
                      </span>
                      {sortField === 'predictedDelay' ? (
                        sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-300" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="py-3 px-4 text-center cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span className={sortField === 'status' ? 'text-indigo-600 font-bold' : ''}>
                        {isHe ? 'סטטוס' : 'Status'}
                      </span>
                      {sortField === 'status' ? (
                        sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-300" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredOrders.map((order, idx) => {
                  const isExpanded = !!expandedOrders[order.id];
                  
                  return (
                    <React.Fragment key={order.id}>
                      {/* Main Row with polished staggered animation */}
                      <motion.tr 
                        id={`order-row-${order.orderNumber}`}
                        onClick={() => toggleRow(order.id)}
                        onMouseEnter={() => setHoveredOrderId(order.id)}
                        onMouseMove={(e) => setMouseCoords({ x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setHoveredOrderId(null)}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ 
                          duration: 0.25, 
                          delay: Math.min(idx * 0.025, 0.35), 
                          ease: "easeOut" 
                        }}
                        className={`group cursor-pointer transition-all duration-200 ease-out gpu-scale-hover hover-border-inset touch-active-state hover:bg-slate-50/80 ${
                          order.orderNumber === selectedOrderNumber
                            ? 'bg-amber-50 hover:bg-amber-100/90 ring-2 ring-amber-400 ring-offset-2 font-semibold shadow-md'
                            : isExpanded
                            ? 'bg-blue-50/10'
                            : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-slate-400 group-hover:text-slate-700" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-700" />
                          )}
                        </td>
                        <td className="py-3.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.includes(order.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOrderIds(prev => [...prev, order.id]);
                              } else {
                                setSelectedOrderIds(prev => prev.filter(id => id !== order.id));
                              }
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                          {order.orderNumber}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                          {formatDate(order.timestamp, lang)}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {translate(order.customerName, lang)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            {translate(order.warehouse, lang)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={translate(order.deliveryAddress, lang)}>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            {translate(order.deliveryAddress, lang)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          {renderDelayFlag(order.id)}
                        </td>
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          {renderStatusBadge(order)}
                        </td>
                      </motion.tr>

                      {/* Expandable Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/40">
                          <td colSpan={9} className="py-4 px-6 border-b border-slate-100">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              
                              {/* Left Columns: Items Sub-table */}
                              <div className="lg:col-span-2 space-y-3">
                                <div className="flex items-center justify-between">
                                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                    <Package className="h-3.5 w-3.5" />
                                    {isHe ? 'פירוט פריטים במשלוח' : 'Item Shipment Manifest'}
                                  </h5>
                                  <span className="text-xs font-semibold text-slate-500">
                                    {order.items?.length || 0} {isHe ? 'מוצרים שונים' : 'unique SKUs'}
                                  </span>
                                </div>
                                
                                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                  <table className="w-full text-left text-xs">
                                    <thead>
                                      <tr className="border-b border-slate-100 bg-slate-50 font-bold text-slate-400 uppercase tracking-wider">
                                        <th className="py-2 px-3">{isHe ? 'מק"ט' : 'SKU'}</th>
                                        <th className="py-2 px-3">{isHe ? 'תיאור פריט' : 'Product Description'}</th>
                                        <th className="py-2 px-3 text-center">{isHe ? 'כמות' : 'Qty'}</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                      {(order.items || []).map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/50">
                                          <td className="py-2 px-3 font-mono font-semibold text-slate-500">{item.sku}</td>
                                          <td className="py-2 px-3 font-semibold text-slate-800">{translate(item.name, lang)}</td>
                                          <td className="py-2 px-3 text-center font-bold text-slate-900 bg-slate-50/30">{item.quantity}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>

                                  {/* Product Calculation & Summary Row */}
                                  <div className="bg-blue-50/40 border-t border-blue-100 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                                    <div className="flex flex-wrap gap-2.5 text-[11px] font-semibold text-slate-600">
                                      <span className="flex items-center gap-1 bg-white border border-slate-200/80 px-2 py-0.5 rounded shadow-2xs">
                                        <span>{isHe ? 'מוצרים שונים:' : 'Unique SKUs:'}</span>
                                        <strong className="text-slate-950 font-black">
                                          {order.items?.length || 0}
                                        </strong>
                                      </span>
                                      
                                      <span className="flex items-center gap-1 bg-white border border-slate-200/80 px-2 py-0.5 rounded shadow-2xs">
                                        <span>{isHe ? 'סה״כ יחידות סחורה:' : 'Total Units Count:'}</span>
                                        <strong className="text-emerald-600 font-black">
                                          {order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0}
                                        </strong>
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                                        {isHe ? 'עומס משוער:' : 'Est. Cargo Load:'}
                                      </span>
                                      {(() => {
                                        const totalQty = order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
                                        let loadLabel = isHe ? 'קל' : 'Light';
                                        let loadColor = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
                                        if (totalQty > 15) {
                                          loadLabel = isHe ? 'כבד מאוד' : 'Heavy';
                                          loadColor = 'bg-rose-500/10 text-rose-600 border-rose-500/20';
                                        } else if (totalQty > 6) {
                                          loadLabel = isHe ? 'בינוני' : 'Medium';
                                          loadColor = 'bg-amber-500/10 text-amber-600 border-amber-500/20';
                                        }
                                        return (
                                          <span className={`text-[10px] font-black border rounded px-1.5 py-0.5 ${loadColor}`}>
                                            {loadLabel}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Right Column: Order Details & Actions */}
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                    {isHe ? 'פרטי שילוח והערות' : 'Dispatch Info & Comments'}
                                  </h5>
                                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5 text-xs text-slate-600">
                                    <div className="flex items-start gap-1.5">
                                      <User className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="font-bold text-slate-800">{isHe ? 'לקוח: ' : 'Customer: '}</span>
                                        {translate(order.customerName, lang)}
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-1.5">
                                      <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="font-bold text-slate-800">{isHe ? 'זמן יצירה: ' : 'Created: '}</span>
                                        {formatDate(order.timestamp, lang)}
                                      </div>
                                    </div>
                                    {order.notes && (
                                      <div className="mt-2 bg-amber-50/70 border border-amber-100 rounded-lg p-2.5 text-amber-900">
                                        <span className="font-bold block mb-0.5">{isHe ? 'הערות מיוחדות לסידור:' : 'Dispatch Note:'}</span>
                                        {order.notes}
                                      </div>
                                    )}
                                  </div>

                                  {/* Dynamic Fulfillment Delay Analyzer inside expandable section */}
                                  {order.status !== 'cancelled' && order.status !== 'delivered' && (
                                    <div className="space-y-2 mt-3">
                                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                        <Activity className="h-3.5 w-3.5 text-blue-500" />
                                        {isHe ? 'מנתח עיכובי שרשרת אספקה' : 'Supply Chain Bottleneck Analyzer'}
                                      </h5>
                                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3 text-xs">
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-slate-700">{isHe ? 'רמת סיכון חריגה:' : 'SLA Breach Probability:'}</span>
                                          <span className={`font-mono font-black rounded px-1.5 py-0.5 text-[11px] ${
                                            orderDelayMetrics[order.id]?.riskCategory === 'breached' 
                                              ? 'bg-rose-100 text-rose-800' 
                                              : orderDelayMetrics[order.id]?.riskCategory === 'high'
                                              ? 'bg-orange-100 text-orange-800'
                                              : orderDelayMetrics[order.id]?.riskCategory === 'medium'
                                              ? 'bg-amber-100 text-amber-800'
                                              : 'bg-blue-100 text-blue-800'
                                          }`}>
                                            {orderDelayMetrics[order.id]?.riskScore}%
                                          </span>
                                        </div>

                                        {/* Progress bar of SLA elapsed */}
                                        <div className="space-y-1">
                                          <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                                            <span>{isHe ? 'חלף מהקליטה:' : 'Elapsed:'} {orderDelayMetrics[order.id]?.elapsedHours}h</span>
                                            <span>SLA: {orderDelayMetrics[order.id]?.slaWindow}h</span>
                                          </div>
                                          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                            <div 
                                              style={{ width: `${Math.min(100, orderDelayMetrics[order.id]?.riskScore || 0)}%` }}
                                              className={`h-full rounded-full transition-all duration-500 ${
                                                orderDelayMetrics[order.id]?.riskCategory === 'breached' 
                                                  ? 'bg-rose-500' 
                                                  : orderDelayMetrics[order.id]?.riskCategory === 'high'
                                                  ? 'bg-orange-500'
                                                  : orderDelayMetrics[order.id]?.riskCategory === 'medium'
                                                  ? 'bg-amber-500'
                                                  : 'bg-blue-500'
                                              }`}
                                            />
                                          </div>
                                        </div>

                                        {/* Detailed factor values */}
                                        <div className="grid grid-cols-2 gap-2 text-[10px] bg-white p-2.5 rounded-lg border border-slate-150 text-slate-600">
                                          <div>
                                            <span className="text-slate-400 block">{isHe ? 'קצב עיבוד מחסן:' : 'Warehouse Rate:'}</span>
                                            <span className="font-bold text-slate-700 font-mono">
                                              {(order.warehouse || '').includes('התלמיד') ? '3.5h (כבד)' : '2.0h (מהיר)'}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-slate-400 block">{isHe ? 'זמן טיפול תקני צפוי:' : 'Expected Handling:'}</span>
                                            <span className="font-bold text-slate-700 font-mono">{orderDelayMetrics[order.id]?.standardProcessingTime}h</span>
                                          </div>
                                          <div className="col-span-2 pt-1 border-t border-slate-100">
                                            <span className="text-slate-400 block">{isHe ? 'גורם עיכוב ראשי:' : 'Primary Bottleneck Factor:'}</span>
                                            <span className="font-bold text-slate-800">
                                              {isHe ? orderDelayMetrics[order.id]?.reasonHe : orderDelayMetrics[order.id]?.reasonEn}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Status transition dispatch actions */}
                                <div className="space-y-2">
                                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                    {isHe ? 'עדכון סטטוס הפצה' : 'Update Dispatch Status'}
                                  </h5>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <button
                                      id={`dispatch-status-pending-${order.id}`}
                                      onClick={() => onUpdateStatus(order.id, 'pending')}
                                      className={`rounded-lg py-1.5 px-2.5 text-xs font-semibold border transition-all duration-200 ease-out gpu-scale-hover hover-border-inset touch-active-state text-center ${
                                        order.status === 'pending'
                                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                      }`}
                                    >
                                      {isHe ? 'סמן כחדש' : 'Set Pending'}
                                    </button>
                                    <button
                                      id={`dispatch-status-processing-${order.id}`}
                                      onClick={() => onUpdateStatus(order.id, 'processing')}
                                      className={`rounded-lg py-1.5 px-2.5 text-xs font-semibold border transition-all duration-200 ease-out gpu-scale-hover hover-border-inset touch-active-state text-center ${
                                        order.status === 'processing'
                                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                      }`}
                                    >
                                      {isHe ? 'התחל טיפול' : 'Start Process'}
                                    </button>
                                    <button
                                      id={`dispatch-status-delivered-${order.id}`}
                                      onClick={() => onUpdateStatus(order.id, 'delivered')}
                                      className={`rounded-lg py-1.5 px-2.5 text-xs font-semibold border transition-all duration-200 ease-out gpu-scale-hover hover-border-inset touch-active-state text-center col-span-2 ${
                                        order.status === 'delivered'
                                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                      }`}
                                    >
                                      {isHe ? 'סמן כנמסר (הושלם)' : 'Mark as Delivered'}
                                    </button>
                                    <button
                                      id={`dispatch-status-cancelled-${order.id}`}
                                      onClick={() => onUpdateStatus(order.id, 'cancelled')}
                                      className={`rounded-lg py-1.5 px-2.5 text-xs font-semibold border transition-all duration-200 ease-out gpu-scale-hover hover-border-inset touch-active-state text-center ${
                                        order.status === 'cancelled'
                                          ? 'bg-slate-200 text-slate-800 border-slate-300'
                                          : 'bg-white text-rose-600 border-rose-100 hover:bg-rose-50/50'
                                      }`}
                                    >
                                      {isHe ? 'בטל משלוח' : 'Cancel Order'}
                                    </button>
                                    
                                    {onDeleteOrder && (
                                      <button
                                        id={`dispatch-delete-${order.id}`}
                                        onClick={() => onDeleteOrder(order.id)}
                                        className="rounded-lg py-1.5 px-2.5 text-xs font-semibold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all duration-200 ease-out gpu-scale-hover hover-border-inset touch-active-state text-center flex items-center justify-center gap-1"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                        <span>{isHe ? 'מחק לחלוטין' : 'Delete Log'}</span>
                                      </button>
                                    )}
                                  </div>
                                </div>

                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Hover Tooltip Overlay */}
      {(() => {
        if (!hoveredOrderId) return null;
        const order = orders.find(o => o.id === hoveredOrderId);
        if (!order) return null;
        
        const lastLog = auditLogs?.find(l => l.orderId === order.id);
        const lastUpdatedTime = lastLog ? lastLog.timestamp : order.timestamp;
        
        return (
          <div 
            className="fixed z-50 pointer-events-none bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-2xl border border-slate-700/80 p-4 w-80 text-xs space-y-3 transition-all duration-75 font-sans"
            style={{
              top: Math.max(10, Math.min(window.innerHeight - 320, mouseCoords.y + 15)),
              left: Math.max(10, Math.min(window.innerWidth - 330, mouseCoords.x + (isHe ? -340 : 15))),
              direction: isHe ? 'rtl' : 'ltr',
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-mono font-bold text-indigo-400">#{order.orderNumber}</span>
              <span className="font-semibold text-slate-400">
                {isHe ? 'פרטי הזמנה' : 'Order Details'}
              </span>
            </div>
            
            <div className="space-y-1.5">
              <div>
                <span className="text-slate-400 font-medium block">{isHe ? 'לקוח:' : 'Customer:'}</span>
                <span className="font-bold text-slate-100">{translate(order.customerName, lang)}</span>
              </div>
              
              <div>
                <span className="text-slate-400 font-medium block">{isHe ? 'כתובת אספקה:' : 'Delivery Address:'}</span>
                <span className="text-slate-200">{translate(order.deliveryAddress, lang)}</span>
              </div>

              <div className="flex justify-between gap-4">
                <div>
                  <span className="text-slate-400 font-medium block">{isHe ? 'מחסן:' : 'Warehouse:'}</span>
                  <span className="text-slate-200">{translate(order.warehouse, lang)}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">{isHe ? 'עומס לוגיסטי:' : 'Cargo Load:'}</span>
                  <span className="text-indigo-400 font-black">
                    {(() => {
                      const totalQty = order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
                      return isHe 
                        ? (totalQty > 15 ? 'כבד' : totalQty > 6 ? 'בינוני' : 'קל')
                        : (totalQty > 15 ? 'Heavy' : totalQty > 6 ? 'Medium' : 'Light');
                    })()}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-medium block">{isHe ? 'פריטים בסבב:' : 'Items:'}</span>
                <div className="max-h-20 overflow-y-auto space-y-0.5 text-[11px] text-slate-300 pr-1">
                  {(order.items || []).map((item, i) => (
                    <div key={i} className="flex justify-between">
                      <span>• {item.name}</span>
                      <span className="font-mono text-slate-400">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex flex-col gap-1">
              <div>
                <span>{isHe ? 'נוצר בתאריך:' : 'Created at:'} </span>
                <span className="font-mono text-slate-300">{formatDate(order.timestamp, lang)}</span>
              </div>
              <div>
                <span>{isHe ? 'עדכון אחרון:' : 'Last updated:'} </span>
                <span className="font-mono text-slate-300">{formatDate(lastUpdatedTime, lang)}</span>
                {lastLog && (
                  <span className="text-slate-500 font-medium block mt-0.5">
                    {isHe 
                      ? `סטטוס שונה ל-${lastLog.newStatus === 'pending' ? 'חדש' : lastLog.newStatus === 'processing' ? 'בטיפול' : lastLog.newStatus === 'delivered' ? 'נמסר' : 'בוטל'} ע"י ${lastLog.updatedBy}` 
                      : `Status updated to ${lastLog.newStatus} by ${lastLog.updatedBy}`}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
