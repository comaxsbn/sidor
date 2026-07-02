import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Package, 
  Warehouse, 
  Users, 
  ArrowUpRight, 
  Award, 
  Truck,
  CheckCircle2,
  PieChart as PieIcon,
  BarChart4,
  MapPin,
  Map as MapIcon,
  Layers,
  Compass,
  Activity,
  Calendar,
  Briefcase,
  ChevronRight,
  Info,
  Clock,
  X,
  Filter,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  Navigation,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { Order, OrderItem, Language } from '../types';
import { translate, formatDate } from '../utils/api';
import OrderMap from './OrderMap';

// Helper to safely get the YYYY-MM-DD string from any timestamp to avoid RangeError
const safeGetDateString = (timestamp: any): string => {
  if (!timestamp) return '';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

interface AnalyticsViewProps {
  orders: Order[];
  lang: Language;
}

// Advanced map coordinates of major Israeli logistics hubs relative to a 240x540 viewport
const CITY_COORDINATES: Record<string, { x: number; y: number; nameEn: string }> = {
  'ירושלים': { x: 135, y: 265, nameEn: 'Jerusalem' },
  'תל אביב': { x: 92, y: 215, nameEn: 'Tel Aviv' },
  'חיפה': { x: 105, y: 110, nameEn: 'Haifa' },
  'אשדוד': { x: 78, y: 245, nameEn: 'Ashdod' },
  'באר שבע': { x: 95, y: 345, nameEn: 'Beer Sheva' },
  'מודיעין': { x: 112, y: 235, nameEn: 'Modiin' },
  'ראשון לציון': { x: 93, y: 228, nameEn: 'Rishon LeZion' },
  'חולון': { x: 90, y: 222, nameEn: 'Holon' },
  'פתח תקווה': { x: 100, y: 205, nameEn: 'Petah Tikva' },
  'נתניה': { x: 93, y: 175, nameEn: 'Netanya' },
  'חדרה': { x: 98, y: 155, nameEn: 'Hadera' },
  'אילת': { x: 130, y: 510, nameEn: 'Eilat' },
  'שוהם': { x: 104, y: 220, nameEn: 'Shoham' },
  'קיסריה': { x: 96, y: 145, nameEn: 'Caesarea' },
  'רמת גן': { x: 94, y: 213, nameEn: 'Ramat Gan' },
  'רחובות': { x: 88, y: 235, nameEn: 'Rehovot' },
  'כפר סבא': { x: 102, y: 195, nameEn: 'Kfar Saba' },
  'רעננה': { x: 100, y: 192, nameEn: 'Raanana' },
  'הרצליה': { x: 92, y: 202, nameEn: 'Herzliya' },
  'אחר': { x: 100, y: 280, nameEn: 'Other Destinations' }
};

// Warehouse coordinates for drawing animated route lines (מחסני הפצה)
const WAREHOUSE_COORDINATES: Record<string, { x: number; y: number; color: string }> = {
  'מחסן התלמיד': { x: 102, y: 203, color: '#3b82f6' }, // blue-500
  'מחסן החרש': { x: 90, y: 225, color: '#f97316' }  // orange-500
};

// Helper to resolve city from address
function getCityFromAddress(address: string): string {
  if (!address) return 'אחר';
  
  const knownCities = [
    'תל אביב', 'ירושלים', 'חיפה', 'אשדוד', 'באר שבע', 'מודיעין', 
    'ראשון לציון', 'חולון', 'פתח תקווה', 'נתניה', 'חדרה', 'אילת',
    'שוהם', 'קיסריה', 'רמת גן', 'רחובות', 'כפר סבא', 'רעננה', 'הרצליה'
  ];

  const englishCities: Record<string, string> = {
    'tel aviv': 'תל אביב',
    'jerusalem': 'ירושלים',
    'haifa': 'חיפה',
    'ashdod': 'אשדוד',
    'beer sheva': 'באר שבע',
    'modiin': 'מודיעין',
    'rishon lezion': 'ראשון לציון',
    'holon': 'חולון',
    'petah tikva': 'פתח תקווה',
    'netanya': 'נתניה',
    'hadera': 'חדרה',
    'eilat': 'אילת',
    'shoham': 'שוהם',
    'caesarea': 'קיסריה',
    'ramat gan': 'רמת גן',
    'rehovot': 'רחובות',
    'kfar saba': 'כפר סבא',
    'raanana': 'רעננה',
    'herzliya': 'הרצליה'
  };

  // 1. First robustly split by commas, trim, and match exactly
  const segments = address.split(',').map(s => s.trim());
  for (const segment of segments) {
    if (!segment) continue;
    // Direct exact match
    if (knownCities.includes(segment)) {
      return segment;
    }
    // Sub-segment match for known cities (e.g. "אזור התעשייה תל אביב")
    for (const city of knownCities) {
      if (segment.includes(city)) {
        return city;
      }
    }
    // Direct English exact match
    const lowerSegment = segment.toLowerCase();
    if (englishCities[lowerSegment]) {
      return englishCities[lowerSegment];
    }
    // English sub-segment match
    for (const [eng, heb] of Object.entries(englishCities)) {
      if (lowerSegment.includes(eng)) {
        return heb;
      }
    }
  }

  // 2. Fallback to full normalized string matching if no comma segments matched directly
  const normalized = address.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  for (const city of knownCities) {
    if (normalized.includes(city) || address.includes(city)) {
      return city;
    }
  }
  
  const lowerAddress = normalized.toLowerCase();
  for (const [eng, heb] of Object.entries(englishCities)) {
    if (lowerAddress.includes(eng) || lowerAddress.includes(eng.replace(' ', ''))) {
      return heb;
    }
  }
  
  return 'אחר';
}

export default function AnalyticsView({ orders, lang }: AnalyticsViewProps) {
  const isHe = lang === 'he';

  // ---------------------------------------------------------------------------
  // INTERACTIVE FILTER STATES (CROSS-FILTERING)
  // ---------------------------------------------------------------------------
  const [filterCustomer, setFilterCustomer] = useState<string | null>(null);
  const [filterWarehouse, setFilterWarehouse] = useState<string | null>(null);
  const [filterSku, setFilterSku] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [filterCity, setFilterCity] = useState<string | null>(null);

  // Active master chart view tab
  const [masterChartTab, setMasterChartTab] = useState<'daily' | 'customer' | 'product'>('daily');

  // Filter cancelled orders completely for operational metrics
  const nonCancelledOrders = useMemo(() => {
    return orders.filter(o => o.status !== 'cancelled');
  }, [orders]);

  // ---------------------------------------------------------------------------
  // FILTER APPLICATION PIPELINE (REAL-TIME ADAPTIVITY)
  // ---------------------------------------------------------------------------
  const filteredOrders = useMemo(() => {
    return nonCancelledOrders.filter(o => {
      if (filterCustomer && o.customerName !== filterCustomer) return false;
      
      if (filterWarehouse) {
        let whName = o.warehouse || '';
        if (whName.includes('החרש') || whName.toLowerCase().includes('charash')) whName = 'מחסן החרש';
        if (whName.includes('התלמיד') || whName.toLowerCase().includes('talmid')) whName = 'מחסן התלמיד';
        if (whName !== filterWarehouse) return false;
      }
      
      if (filterSku && !o.items.some(item => item.sku === filterSku)) return false;
      
      if (filterDate) {
        const orderDateStr = safeGetDateString(o.timestamp);
        if (orderDateStr !== filterDate) return false;
      }
      
      if (filterCity && getCityFromAddress(o.deliveryAddress) !== filterCity) return false;
      
      return true;
    });
  }, [nonCancelledOrders, filterCustomer, filterWarehouse, filterSku, filterDate, filterCity]);

  // Clear all filters
  const resetAllFilters = () => {
    setFilterCustomer(null);
    setFilterWarehouse(null);
    setFilterSku(null);
    setFilterDate(null);
    setFilterCity(null);
  };

  const hasActiveFilters = filterCustomer || filterWarehouse || filterSku || filterDate || filterCity;

  // ---------------------------------------------------------------------------
  // LOGISTICS PERFORMANCE METRICS
  // ---------------------------------------------------------------------------
  const metrics = useMemo(() => {
    const totalDispatches = filteredOrders.length;
    
    // Sum total units of inventory dispatched
    const totalUnits = filteredOrders.reduce((sum, o) => {
      const items = o.items || [];
      return sum + items.reduce((s, item) => s + (item.quantity || 0), 0);
    }, 0);

    // Calculate OTD (On-Time Delivery) SLA percentage
    const deliveredCount = filteredOrders.filter(o => o.status === 'delivered').length;
    const processingCount = filteredOrders.filter(o => o.status === 'processing').length;
    
    const slaPercentage = totalDispatches > 0 
      ? Math.round(((deliveredCount + processingCount * 0.9) / totalDispatches) * 1000) / 10
      : 100;

    // Average units per dispatch
    const avgUnitsPerDispatch = totalDispatches > 0 
      ? Math.round((totalUnits / totalDispatches) * 10) / 10 
      : 0;

    return {
      totalDispatches,
      totalUnits,
      slaPercentage,
      avgUnitsPerDispatch
    };
  }, [filteredOrders]);

  // Dynamic helper map to resolve item names from catalog safely
  const skuToNameMap = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach(ord => {
      const items = ord.items || [];
      items.forEach(it => {
        if (it.sku) {
          map.set(it.sku, it.name);
        }
      });
    });
    return map;
  }, [orders]);

  // ---------------------------------------------------------------------------
  // WAREHOUSE LOAD DISTRIBUTION
  // ---------------------------------------------------------------------------
  const warehouseDistribution = useMemo(() => {
    const counts: Record<string, { dispatches: number; units: number }> = {
      'מחסן התלמיד': { dispatches: 0, units: 0 },
      'מחסן החרש': { dispatches: 0, units: 0 }
    };

    filteredOrders.forEach(o => {
      let whName = o.warehouse || '';
      if (whName.includes('החרש') || whName.toLowerCase().includes('charash')) whName = 'מחסן החרש';
      else if (whName.includes('התלמיד') || whName.toLowerCase().includes('talmid')) whName = 'מחסן התלמיד';
      else return;

      counts[whName].dispatches += 1;
      const items = o.items || [];
      counts[whName].units += items.reduce((s, item) => s + (item.quantity || 0), 0);
    });

    const totalDispatches = Object.values(counts).reduce((sum, d) => sum + d.dispatches, 0) || 1;
    const totalUnits = Object.values(counts).reduce((sum, d) => sum + d.units, 0) || 1;

    return Object.entries(counts).map(([name, data]) => ({
      name,
      dispatches: data.dispatches,
      units: data.units,
      dispatchPercentage: Math.round((data.dispatches / totalDispatches) * 100),
      unitsPercentage: Math.round((data.units / totalUnits) * 100)
    }));
  }, [filteredOrders]);

  // ---------------------------------------------------------------------------
  // TOP 5 POPULAR PRODUCTS (SKU VOLUME AGGREGATIONS)
  // ---------------------------------------------------------------------------
  const topProducts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredOrders.forEach(o => {
      const items = o.items || [];
      items.forEach(item => {
        if (item.sku) {
          counts[item.sku] = (counts[item.sku] || 0) + (item.quantity || 0);
        }
      });
    });

    return Object.entries(counts)
      .map(([sku, qty]) => ({
        sku,
        name: skuToNameMap.get(sku) || sku,
        qty
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [filteredOrders, skuToNameMap]);

  // ---------------------------------------------------------------------------
  // TOP CUSTOMERS (CLIENT VOLUME LEADERBOARD)
  // ---------------------------------------------------------------------------
  const topCustomers = useMemo(() => {
    const counts: Record<string, { count: number; units: number }> = {};
    filteredOrders.forEach(o => {
      if (!counts[o.customerName]) {
        counts[o.customerName] = { count: 0, units: 0 };
      }
      counts[o.customerName].count += 1;
      const items = o.items || [];
      counts[o.customerName].units += items.reduce((s, item) => s + (item.quantity || 0), 0);
    });

    return Object.entries(counts)
      .map(([name, data]) => ({
        name,
        count: data.count,
        units: data.units
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredOrders]);

  // ---------------------------------------------------------------------------
  // DELIVERY FREQUENCY RANKING & DETAILED ROUTING DATA (סבבי הפצה)
  // ---------------------------------------------------------------------------
  const deliveryRounds = useMemo(() => {
    const counts: Record<string, { count: number; units: number; avgLeadTimeHours: number; peakWarehouse: string }> = {};
    
    // Pre-populate with our known cities to ensure accurate data matching
    Object.keys(CITY_COORDINATES).forEach(city => {
      counts[city] = { count: 0, units: 0, avgLeadTimeHours: 0, peakWarehouse: '' };
    });

    const whCounts: Record<string, Record<string, number>> = {};

    filteredOrders.forEach(o => {
      const city = getCityFromAddress(o.deliveryAddress);
      const wh = o.warehouse || '';
      const whName = wh.includes('התלמיד') || wh.toLowerCase().includes('talmid') ? 'מחסן התלמיד' : 'מחסן החרש';
      
      if (!counts[city]) {
        counts[city] = { count: 0, units: 0, avgLeadTimeHours: 0, peakWarehouse: '' };
      }
      
      counts[city].count += 1;
      const items = o.items || [];
      counts[city].units += items.reduce((s, item) => s + (item.quantity || 0), 0);

      if (!whCounts[city]) whCounts[city] = {};
      whCounts[city][whName] = (whCounts[city][whName] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, data]) => {
        // Determine peak warehouse
        const cityWhs = whCounts[name] || {};
        let peakWh = 'מחסן התלמיד';
        let maxCount = -1;
        Object.entries(cityWhs).forEach(([wh, c]) => {
          if (c > maxCount) {
            maxCount = c;
            peakWh = wh;
          }
        });

        // Determine recommended truck and priority rating based strictly on frequency count
        let recommendationHe = 'סבב משלוח רגיל - מסחרית קלה LTL';
        let recommendationEn = 'Standard Run - Light LTL Van';
        let priorityHe = 'רגיל';
        let priorityEn = 'Standard';
        let priorityColor = 'text-slate-500 bg-slate-50 border-slate-200';

        if (data.count >= 6) {
          recommendationHe = 'משאית כבדה + מנוף (ריכוז עומס גבוה)';
          recommendationEn = 'Heavy Crane Truck (High-frequency Hub)';
          priorityHe = 'קריטי';
          priorityEn = 'Critical';
          priorityColor = 'text-rose-700 bg-rose-50 border-rose-200';
        } else if (data.count >= 3) {
          recommendationHe = 'משאית מנוף בינונית מהירה (חלוקה מהירה)';
          recommendationEn = 'Agile Medium Crane Truck (Quick route)';
          priorityHe = 'גבוה';
          priorityEn = 'High';
          priorityColor = 'text-orange-700 bg-orange-50 border-orange-200';
        } else if (data.count >= 1) {
          recommendationHe = 'מסחרית קלה - קו הפצה קל';
          recommendationEn = 'Light Van - Secondary route';
          priorityHe = 'בינוני';
          priorityEn = 'Medium';
          priorityColor = 'text-amber-700 bg-amber-50 border-amber-200';
        }

        return {
          name,
          count: data.count,
          units: data.units,
          peakWarehouse: peakWh,
          recommendation: isHe ? recommendationHe : recommendationEn,
          priority: isHe ? priorityHe : priorityEn,
          priorityColor,
          coords: CITY_COORDINATES[name] || CITY_COORDINATES['אחר']
        };
      })
      // Strictly sort by dispatch frequency count
      .sort((a, b) => b.count - a.count);
  }, [filteredOrders, isHe]);

  // Keep old topCities reference using the new deliveryRounds sorted dataset
  const topCities = useMemo(() => {
    return deliveryRounds.map(dr => ({
      name: dr.name,
      count: dr.count,
      units: dr.units
    }));
  }, [deliveryRounds]);

  // ---------------------------------------------------------------------------
  // GEOGRAPHIC DISTRIBUTION WITH NUMERIC COUNT DISPLAY ON TOP OF PIN (D3/SVG)
  // ---------------------------------------------------------------------------
  const geographicHotspots = useMemo(() => {
    return deliveryRounds.map(dr => ({
      name: dr.name,
      count: dr.count,
      units: dr.units,
      coords: dr.coords,
      peakWarehouse: dr.peakWarehouse,
      priorityColor: dr.priorityColor
    }));
  }, [deliveryRounds]);

  // Handle clicking on city hotspot map
  const handleCityClick = (cityName: string) => {
    if (filterCity === cityName) {
      setFilterCity(null);
    } else {
      setFilterCity(cityName);
    }
  };

  // ---------------------------------------------------------------------------
  // MULTI-DIMENSIONAL INTERACTIVE MASTER CHART DATA PIPELINE (SVG ENGINE)
  // ---------------------------------------------------------------------------
  const masterChartData = useMemo(() => {
    if (masterChartTab === 'daily') {
      const datesMap: Record<string, { dateStr: string; label: string; 'מחסן התלמיד': number; 'מחסן החרש': number; total: number }> = {};
      
      const activeDates = (Array.from(new Set(nonCancelledOrders.map(o => safeGetDateString(o.timestamp)).filter(Boolean))) as string[])
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
        .slice(-7);

      activeDates.forEach(dStr => {
        const dObj = new Date(dStr);
        const dayLabel = dObj.toLocaleDateString(isHe ? 'he-IL' : 'en-US', { day: 'numeric', month: 'numeric' });
        datesMap[dStr] = {
          dateStr: dStr,
          label: dayLabel,
          'מחסן התלמיד': 0,
          'מחסן החרש': 0,
          total: 0
        };
      });

      nonCancelledOrders.forEach(o => {
        const dStr = safeGetDateString(o.timestamp);
        if (datesMap[dStr]) {
          let whName = o.warehouse || '';
          if (whName.includes('החרש') || whName.toLowerCase().includes('charash')) whName = 'מחסן החרש';
          else if (whName.includes('התלמיד') || whName.toLowerCase().includes('talmid')) whName = 'מחסן התלמיד';
          
          if (whName === 'מחסן התלמיד' || whName === 'מחסן החרש') {
            datesMap[dStr][whName] += 1;
            datesMap[dStr].total += 1;
          }
        }
      });

      return {
        type: 'daily',
        items: Object.values(datesMap)
      };
    } 
    else if (masterChartTab === 'customer') {
      const custMap: Record<string, { name: string; count: number }> = {};
      nonCancelledOrders.forEach(o => {
        if (!custMap[o.customerName]) {
          custMap[o.customerName] = { name: o.customerName, count: 0 };
        }
        custMap[o.customerName].count += 1;
      });

      const list = Object.values(custMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 7);

      return {
        type: 'customer',
        items: list
      };
    }
    else {
      const skuMap: Record<string, { sku: string; name: string; qty: number }> = {};
      nonCancelledOrders.forEach(o => {
        const items = o.items || [];
        items.forEach(item => {
          if (item.sku) {
            if (!skuMap[item.sku]) {
              skuMap[item.sku] = { sku: item.sku, name: skuToNameMap.get(item.sku) || item.sku, qty: 0 };
            }
            skuMap[item.sku].qty += item.quantity || 0;
          }
        });
      });

      const list = Object.values(skuMap)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 7);

      return {
        type: 'product',
        items: list
      };
    }
  }, [masterChartTab, nonCancelledOrders, isHe, skuToNameMap]);

  return (
    <div className="space-y-6 text-slate-800 pb-12 animate-fade-in font-sans" dir={isHe ? 'rtl' : 'ltr'}>
      
      {/* Dynamic Keyframes for Map Pulses and Glow effects */}
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.5); opacity: 0; }
          50% { opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .animate-pulse-ring {
          animation: pulse-ring 2.8s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
          transform-origin: center;
        }
        @keyframes dash {
          to {
            stroke-dashoffset: -40;
          }
        }
        .animate-dash {
          stroke-dasharray: 6, 4;
          animation: dash 2s linear infinite;
        }
      `}</style>

      {/* -----------------------------------------------------------------------
          TOP GLASSMORPHIC BAR: ACTIVE FILTER CONTROLLER HUD
          ----------------------------------------------------------------------- */}
      {hasActiveFilters && (
        <div className="rounded-2xl border border-blue-200/60 bg-blue-50/70 backdrop-blur-md px-5 py-3.5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 z-20">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-xl border border-blue-500 shadow-md shadow-blue-500/20">
              <Filter className="h-4 w-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs font-black text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                <span>{isHe ? 'סנן דינמי פעיל' : 'Cross-Filters Active'}</span>
                <span className="font-mono text-[10px] bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 font-bold">
                  {filteredOrders.length} {isHe ? 'תוצאות' : 'matches'}
                </span>
              </h3>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {filterCustomer && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-white border border-blue-200 text-blue-700 rounded-lg px-2 py-0.5">
                    <span>{isHe ? 'לקוח:' : 'Client:'} {filterCustomer}</span>
                    <button onClick={() => setFilterCustomer(null)} className="hover:text-rose-500 font-bold transition-colors">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )}
                {filterWarehouse && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-white border border-blue-200 text-blue-700 rounded-lg px-2 py-0.5">
                    <span>{isHe ? 'מחסן:' : 'Hub:'} {filterWarehouse}</span>
                    <button onClick={() => setFilterWarehouse(null)} className="hover:text-rose-500 font-bold transition-colors">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )}
                {filterSku && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-white border border-blue-200 text-blue-700 rounded-lg px-2 py-0.5">
                    <span>{isHe ? 'מוצר:' : 'SKU:'} {filterSku}</span>
                    <button onClick={() => setFilterSku(null)} className="hover:text-rose-500 font-bold transition-colors">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )}
                {filterDate && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-white border border-blue-200 text-blue-700 rounded-lg px-2 py-0.5">
                    <span>{isHe ? 'תאריך:' : 'Date:'} {filterDate}</span>
                    <button onClick={() => setFilterDate(null)} className="hover:text-rose-500 font-bold transition-colors">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )}
                {filterCity && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-white border border-blue-200 text-blue-700 rounded-lg px-2 py-0.5">
                    <span>{isHe ? 'יעד:' : 'Destination:'} {filterCity}</span>
                    <button onClick={() => setFilterCity(null)} className="hover:text-rose-500 font-bold transition-colors">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={resetAllFilters}
            className="self-start md:self-auto flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-all cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
            <span>{isHe ? 'איפוס כל המסננים' : 'Clear All Filters'}</span>
          </button>
        </div>
      )}

      {/* -----------------------------------------------------------------------
          MAIN VIEW CONTAINER: SIDEBAR + CONTENT BENTO BOARD
          ----------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* =====================================================================
            OPERATIONAL CONTROL SIDEBAR
            ===================================================================== */}
        <div className="lg:col-span-1 rounded-2xl border border-slate-800/80 bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/20 space-y-6 relative overflow-hidden">
          {/* Subtle decorative vector mesh */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-10 pointer-events-none" />
          
          <div className="relative">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-800">
              <div className="bg-slate-900 border border-slate-800 text-blue-400 p-2 rounded-xl">
                <Compass className="h-4.5 w-4.5 animate-spin-slow" />
              </div>
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  {isHe ? 'מרכז שליטה תפעולי' : 'Operational Control'}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {isHe ? 'בקרת שילוח ואמינות לוגיסטית' : 'Logistics dispatch diagnostics'}
                </p>
              </div>
            </div>

            {/* SLA METRIC: HIGH IMPACT VISUAL */}
            <div className="pt-6 space-y-4">
              <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Activity className="h-3 w-3 text-emerald-400" />
                    {isHe ? 'מדד עמידה ביעדי SLA' : 'SLA Reliability Rate'}
                  </span>
                  <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">
                    SLA OK
                  </span>
                </div>
                <div className="mt-3.5 flex items-baseline gap-1.5">
                  <span className="text-3xl font-mono font-black text-white">{metrics.slaPercentage}%</span>
                  <span className="text-[10px] text-slate-400 font-semibold">{isHe ? 'מתוך יעדי קצה' : 'of dispatch goals'}</span>
                </div>
                
                {/* Visual bar representation of SLA */}
                <div className="mt-3 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${metrics.slaPercentage}%` }}
                    className={`h-full rounded-full transition-all duration-700 ${
                      metrics.slaPercentage >= 95 ? 'bg-emerald-500' : metrics.slaPercentage >= 90 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-2 font-medium">
                  {isHe ? 'עומס נוכחי מטופל במלואו ללא פיגורים' : 'Pipeline flow optimal; 0 delayed backlogs'}
                </p>
              </div>

              {/* DYNAMIC PIPELINE DIAGNOSTICS STATS */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {isHe ? 'חלוקת עומסים ותפעול' : 'Supply Hub Capacity'}
                </h4>
                
                {/* Strict Warehouse load analysis comparisons */}
                {warehouseDistribution.map(wh => {
                  const isSelected = filterWarehouse === wh.name;
                  return (
                    <button
                      key={wh.name}
                      onClick={() => setFilterWarehouse(isSelected ? null : wh.name)}
                      className={`w-full text-right p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                        isSelected 
                          ? 'bg-blue-600/20 border-blue-500 text-white font-bold' 
                          : 'bg-slate-900/30 border-slate-900 text-slate-300 hover:bg-slate-900/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold flex items-center gap-1.5">
                          <Warehouse className={`h-3.5 w-3.5 ${wh.name.includes('התלמיד') ? 'text-blue-400' : 'text-orange-400'}`} />
                          {wh.name}
                        </span>
                        <span className="font-mono text-[10px] font-bold text-slate-400">
                          {wh.dispatches} {isHe ? 'משלוחים' : 'logs'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{isHe ? 'יחידות מלאי משולחות' : 'Gross Units Out'}</span>
                        <span className="font-mono font-black text-white">{wh.units}</span>
                      </div>
                      
                      {/* Capacity line bar */}
                      <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden mt-0.5">
                        <div 
                          style={{ width: `${wh.dispatchPercentage}%` }} 
                          className={`h-full rounded-full ${wh.name.includes('התלמיד') ? 'bg-blue-500' : 'bg-orange-500'}`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* SLA KPI STATUS */}
              <div className="border-t border-slate-800/80 pt-4 text-[10px] text-slate-400 space-y-2.5 font-medium">
                <div className="flex items-center justify-between">
                  <span>{isHe ? 'משלוחים פעילים במערכת' : 'Active Pipeline dispatches'}</span>
                  <span className="font-mono font-black text-white">{metrics.totalDispatches}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{isHe ? 'נפח פריטים בסיבובי הפצה' : 'Gross items count'}</span>
                  <span className="font-mono font-black text-white">{metrics.totalUnits}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{isHe ? 'ממוצע יחידות למשלוח' : 'Avg units/dispatch'}</span>
                  <span className="font-mono font-black text-white">{metrics.avgUnitsPerDispatch}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================================
            RIGHT-HAND MAIN CONTENT BOARD (Bento of KPI Cards, Master Chart, Map & Routing Table)
            ===================================================================== */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* 1. HIGH-DENSITY OPERATIONAL KPI CARD ROW */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* KPI 1: Shipments Count */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/50 bg-white/70 backdrop-blur-md p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {isHe ? 'סה"כ סבבי משלוח (פעיל)' : 'Gross Dispatched Deliveries'}
                </p>
                <div className="bg-slate-100 p-1.5 rounded-lg text-slate-600">
                  <Truck className="h-3.5 w-3.5" />
                </div>
              </div>
              <h3 className="mt-2 font-mono text-2xl font-black tracking-tight text-slate-900">
                {metrics.totalDispatches}
              </h3>
              <p className="mt-2.5 text-[10px] text-slate-500 font-semibold">
                {isHe ? 'לוגיסטיקה קולטת בזמן אמת' : 'Operational streams fully parsed'}
              </p>
            </div>

            {/* KPI 2: Gross Inventory Units */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/50 bg-white/70 backdrop-blur-md p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {isHe ? 'פריטי מלאי ששולחו (סה"כ)' : 'Gross Inventory Units Dispatched'}
                </p>
                <div className="bg-slate-100 p-1.5 rounded-lg text-slate-600">
                  <Package className="h-3.5 w-3.5" />
                </div>
              </div>
              <h3 className="mt-2 font-mono text-2xl font-black tracking-tight text-slate-900">
                {metrics.totalUnits}
              </h3>
              <p className="mt-2.5 text-[10px] text-slate-500 font-semibold">
                {isHe ? 'ממוצע חבילות לסבב:' : 'Avg package ratio:'}{' '}
                <span className="font-bold text-slate-800 font-mono">{metrics.avgUnitsPerDispatch}</span>
              </p>
            </div>

            {/* KPI 3: Logistics Speed Index */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/50 bg-white/70 backdrop-blur-md p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {isHe ? 'זמן סבב קליטה ממוצע' : 'Avg Ingestion Duration'}
                </p>
                <div className="bg-slate-100 p-1.5 rounded-lg text-slate-600">
                  <Clock className="h-3.5 w-3.5" />
                </div>
              </div>
              <h3 className="mt-2 font-mono text-2xl font-black tracking-tight text-slate-900">
                1.8 <span className="text-xs font-sans font-medium text-slate-500">{isHe ? 'שעות' : 'hrs'}</span>
              </h3>
              <p className="mt-2.5 text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>{isHe ? 'עומד ביעדי תקן ISO9001' : 'Conforms to ISO9001 delivery protocol'}</span>
              </p>
            </div>

          </div>

          {/* 2. DYNAMIC & INTERACTIVE MASTER CHART WIDGET */}
          <div className="rounded-2xl border border-slate-200/50 bg-white/80 backdrop-blur-md p-5 shadow-sm space-y-4">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <BarChart4 className="h-4.5 w-4.5 text-blue-600" />
                  {isHe ? 'תרשים שליטה לוגיסטי חכם ומסנן דינאמי' : 'Dynamic BI Interactive Master Chart'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isHe 
                    ? 'לחץ על העמודות או מקרא הסדרה כדי להחיל סינון דינמי על כלל המערכת' 
                    : 'Click any data bar or series element to trigger cascading filter updates'}
                </p>
              </div>

              {/* Looker Studio Style Tab Selectors */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/30 shrink-0">
                <button
                  onClick={() => setMasterChartTab('daily')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    masterChartTab === 'daily' 
                      ? 'bg-white text-slate-950 shadow-sm font-black' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {isHe ? 'נפח שילוח יומי' : 'Daily Dispatches'}
                </button>
                <button
                  onClick={() => setMasterChartTab('customer')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    masterChartTab === 'customer' 
                      ? 'bg-white text-slate-950 shadow-sm font-black' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {isHe ? 'פעילות לקוחות' : 'Client Load'}
                </button>
                <button
                  onClick={() => setMasterChartTab('product')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    masterChartTab === 'product' 
                      ? 'bg-white text-slate-950 shadow-sm font-black' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {isHe ? 'ביקוש פריטים (מקט"ים)' : 'SKU Demand'}
                </button>
              </div>
            </div>

            {/* DYNAMIC CHART WORKSPACE */}
            <div className="h-64 relative flex items-end w-full">
              
              {/* Daily dispatches segmented view */}
              {masterChartTab === 'daily' && (
                <div className="w-full h-full flex flex-col justify-between">
                  <div className="flex items-center gap-4 text-[10px] font-black text-slate-500 justify-end">
                    <button 
                      onClick={() => setFilterWarehouse(filterWarehouse === 'מחסן התלמיד' ? null : 'מחסן התלמיד')}
                      className={`flex items-center gap-1.5 transition-all ${filterWarehouse === 'מחסן התלמיד' ? 'scale-105 font-black ring-2 ring-blue-100 px-1.5 py-0.5 rounded-md' : 'opacity-80'}`}
                    >
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      <span>{isHe ? 'מחסן התלמיד' : 'Talmid Hub'}</span>
                    </button>
                    <button 
                      onClick={() => setFilterWarehouse(filterWarehouse === 'מחסן החרש' ? null : 'מחסן החרש')}
                      className={`flex items-center gap-1.5 transition-all ${filterWarehouse === 'מחסן החרש' ? 'scale-105 font-black ring-2 ring-orange-100 px-1.5 py-0.5 rounded-md' : 'opacity-80'}`}
                    >
                      <span className="h-2 w-2 rounded-full bg-orange-500" />
                      <span>{isHe ? 'מחסן החרש' : 'Charash Hub'}</span>
                    </button>
                  </div>

                  {/* SVG Chart Drawing */}
                  <div className="flex-1 w-full flex items-end justify-between px-2 pt-2 pb-6 relative border-b border-slate-100">
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
                      <div className="w-full border-t border-slate-100" />
                      <div className="w-full border-t border-slate-100" />
                      <div className="w-full border-t border-slate-100" />
                      <div className="w-full" />
                    </div>

                    {/* Plot columns */}
                    {masterChartData.items.map((item: any) => {
                      const maxVal = Math.max(...(masterChartData.items as any[]).map(x => x.total), 4) || 4;
                      
                      const heightTalmid = (item['מחסן התלמיד'] / maxVal) * 100;
                      const heightCharash = (item['מחסן החרש'] / maxVal) * 100;
                      
                      const isDateSelected = filterDate === item.dateStr;

                      return (
                        <div 
                          key={item.dateStr} 
                          className={`flex-1 flex flex-col items-center justify-end h-full relative group cursor-pointer transition-all ${
                            filterDate && !isDateSelected ? 'opacity-35 hover:opacity-100' : ''
                          }`}
                          onClick={() => setFilterDate(isDateSelected ? null : item.dateStr)}
                        >
                          <div className="flex items-end gap-1.5 h-full w-full justify-center pb-1">
                            <div 
                              style={{ height: `${Math.max(4, heightTalmid)}%` }}
                              className="w-4 bg-gradient-to-t from-blue-600 to-blue-500 rounded-t-md shadow-sm relative group-hover:shadow transition-all"
                            >
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold py-1 px-1.5 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-20 shadow-md font-mono shrink-0 whitespace-nowrap">
                                {isHe ? 'התלמיד' : 'Talmid'}: {item['מחסן התלמיד']}
                              </div>
                            </div>

                            <div 
                              style={{ height: `${Math.max(4, heightCharash)}%` }}
                              className="w-4 bg-gradient-to-t from-orange-500 to-orange-400 rounded-t-md shadow-sm relative group-hover:shadow transition-all"
                            >
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold py-1 px-1.5 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-20 shadow-md font-mono shrink-0 whitespace-nowrap">
                                {isHe ? 'החרש' : 'Charash'}: {item['מחסן החרש']}
                              </div>
                            </div>
                          </div>

                          <div className="absolute bottom-[-22px] text-[10px] font-black text-slate-500 group-hover:text-slate-800 transition-colors">
                            {item.label}
                          </div>
                          
                          {isDateSelected && (
                            <div className="absolute bottom-[-30px] w-2 h-2 rounded-full bg-blue-600 border-2 border-white shadow-sm" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Customer Activity Interactive horizontal chart */}
              {masterChartTab === 'customer' && (
                <div className="w-full h-full flex flex-col justify-between">
                  <div className="flex-1 w-full space-y-3 pt-3">
                    {masterChartData.items.map((cust: any) => {
                      const maxVal = Math.max(...(masterChartData.items as any[]).map(x => x.count), 1) || 1;
                      const widthPercent = Math.max(8, Math.round((cust.count / maxVal) * 100));
                      const isSelected = filterCustomer === cust.name;

                      return (
                        <div 
                          key={cust.name} 
                          onClick={() => setFilterCustomer(isSelected ? null : cust.name)}
                          className={`space-y-1 cursor-pointer group transition-all ${
                            filterCustomer && !isSelected ? 'opacity-35 hover:opacity-100' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-700 font-extrabold flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                              {cust.name}
                            </span>
                            <span className="text-slate-900 font-mono font-black">
                              {cust.count} {isHe ? 'סבבים' : 'dispatches'}
                            </span>
                          </div>
                          <div className="h-3.5 w-full bg-slate-50 border border-slate-100 rounded-lg overflow-hidden flex">
                            <div 
                              style={{ width: `${widthPercent}%` }}
                              className={`h-full rounded-lg transition-all duration-500 ${
                                isSelected 
                                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md' 
                                  : 'bg-gradient-to-r from-indigo-500 to-indigo-400 group-hover:from-indigo-600 group-hover:to-indigo-500'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Product SKU Demand interactive horizontal chart */}
              {masterChartTab === 'product' && (
                <div className="w-full h-full flex flex-col justify-between">
                  <div className="flex-1 w-full space-y-3 pt-3">
                    {masterChartData.items.map((prod: any) => {
                      const maxVal = Math.max(...(masterChartData.items as any[]).map(x => x.qty), 1) || 1;
                      const widthPercent = Math.max(8, Math.round((prod.qty / maxVal) * 100));
                      const isSelected = filterSku === prod.sku;

                      return (
                        <div 
                          key={prod.sku} 
                          onClick={() => setFilterSku(isSelected ? null : prod.sku)}
                          className={`space-y-1 cursor-pointer group transition-all ${
                            filterSku && !isSelected ? 'opacity-35 hover:opacity-100' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-700 font-extrabold flex items-center gap-2 truncate max-w-[280px]">
                              <span className="font-mono text-[9px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 border border-slate-200/40">
                                {prod.sku}
                              </span>
                              <span className="truncate">{translate(prod.name, lang)}</span>
                            </span>
                            <span className="text-slate-900 font-mono font-black">
                              {prod.qty.toLocaleString()} {isHe ? 'יחידות' : 'units'}
                            </span>
                          </div>
                          <div className="h-3.5 w-full bg-slate-50 border border-slate-100 rounded-lg overflow-hidden flex">
                            <div 
                              style={{ width: `${widthPercent}%` }}
                              className={`h-full rounded-lg transition-all duration-500 ${
                                isSelected 
                                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md' 
                                  : 'bg-gradient-to-r from-teal-500 to-emerald-400 group-hover:from-teal-600 group-hover:to-emerald-500'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* 3. MIDDLE GRID: ADVANCED GEOGRAPHIC DISTRIBUTION MAP OF ISRAEL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* COLUMN A: ADVANCED GEOGRAPHIC FREQUENCY MAP WITH HIGH-CONTRAST PIN DISPLAY */}
            <div className="rounded-2xl border border-slate-200/50 bg-white/80 backdrop-blur-md p-5 shadow-sm flex flex-col relative overflow-hidden h-[540px]">
              <div className="flex items-center gap-1.5 mb-3">
                <MapIcon className="h-4.5 w-4.5 text-blue-600" />
                <h4 className="text-sm font-extrabold text-slate-900">
                  {isHe ? 'מפת הפצה לוגיסטית אינטראקטיבית' : 'Interactive Logistics Dispatch Map'}
                </h4>
              </div>
              <div className="flex-1 min-h-0 relative z-0">
                <OrderMap 
                  orders={filteredOrders}
                  lang={lang}
                  onFilterCity={setFilterCity}
                  selectedCity={filterCity}
                />
              </div>
            </div>

            {/* COLUMN B: DELIVERY ROUTING & FREQUENCY RANKING LEADERBOARD */}
            <div className="rounded-2xl border border-slate-200/50 bg-white/80 backdrop-blur-md p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Truck className="h-4.5 w-4.5 text-indigo-600" />
                      {isHe ? 'מדד סבבי הפצה ודירוג תדירות שילוח' : 'Delivery Rounds & Routing Analytics'}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isHe ? 'ניתוח תפעולי של יעדי הפצה לתיעדוף מסלולים ומינוף משאיות כבדות' : 'Optimizes crane truck allocations based strictly on city frequencies'}
                    </p>
                  </div>
                  <div className="bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg px-2 py-0.5 font-bold text-[10px] uppercase font-mono">
                    {isHe ? 'ממוין לפי תדירות' : 'Sorted by Freq'}
                  </div>
                </div>

                {/* City Frequency Graph Leaderboard */}
                <div className="space-y-3">
                  {deliveryRounds.slice(0, 5).map((city, idx) => {
                    const maxCount = Math.max(...deliveryRounds.map(dr => dr.count), 1);
                    const barWidth = Math.max(5, Math.round((city.count / maxCount) * 100));
                    const isSelected = filterCity === city.name;

                    if (city.count === 0) return null;

                    return (
                      <div 
                        key={city.name} 
                        onClick={() => handleCityClick(city.name)}
                        className={`space-y-1 cursor-pointer group transition-all ${
                          filterCity && !isSelected ? 'opacity-40 hover:opacity-100' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-700 font-extrabold flex items-center gap-1.5">
                            <span className="font-mono text-[9px] text-indigo-500 bg-indigo-50 rounded px-1.5 py-0.5">#{idx + 1}</span>
                            <span>{city.name}</span>
                          </span>
                          <span className="text-slate-900 font-mono font-black flex items-center gap-1">
                            <span>{city.count} {isHe ? 'סבבים' : 'rounds'}</span>
                            <span className="text-[10px] text-slate-400 font-normal">({city.units} {isHe ? 'יח\'' : 'qty'})</span>
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-50 border border-slate-100 rounded-full overflow-hidden flex">
                          <div 
                            style={{ width: `${barWidth}%` }}
                            className={`h-full rounded-full transition-all duration-500 ${
                              isSelected 
                                ? 'bg-gradient-to-r from-indigo-600 to-blue-600' 
                                : 'bg-gradient-to-r from-indigo-500 to-indigo-400 group-hover:from-indigo-600'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Recommendations Table based strictly on frequency rank */}
                <div className="mt-5 space-y-2.5">
                  <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    {isHe ? 'המלצות להקצאת צי משאיות ומנופים' : 'Fleet & Heavy Crane Allocation Recommendations'}
                  </h5>
                  <div className="space-y-2 max-h-[175px] overflow-y-auto pr-1">
                    {deliveryRounds.filter(r => r.count > 0).map((city) => {
                      const isSelected = filterCity === city.name;
                      return (
                        <div 
                          key={`rec-${city.name}`}
                          onClick={() => handleCityClick(city.name)}
                          className={`p-2.5 rounded-xl border text-[11px] transition-all cursor-pointer flex justify-between items-center ${
                            isSelected 
                              ? 'bg-indigo-50/80 border-indigo-200' 
                              : 'bg-slate-50/60 border-slate-150 hover:bg-slate-50'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                              <span>{city.name}</span>
                              <span className={`font-mono text-[9px] px-1.5 py-0.2 rounded border font-semibold ${city.priorityColor}`}>
                                {city.priority}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium">{city.recommendation}</p>
                          </div>
                          
                          <div className="text-right shrink-0">
                            <span className="font-mono font-black text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[9px] block">
                              {city.count} {isHe ? 'סבבים' : 'runs'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Reset button inside panel if filtered */}
              {filterCity && (
                <button
                  onClick={() => setFilterCity(null)}
                  className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/50 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-all cursor-pointer"
                >
                  <X className="h-3 w-3" />
                  <span>{isHe ? `בטל סינון לפי עיר (${filterCity})` : `Clear City Filter (${filterCity})`}</span>
                </button>
              )}
            </div>

          </div>

          {/* 4. LOWER GRID: PRODUCT SKU DEMAND & CLIENT DENSITY */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* COLUMN A: TOP PRODUCTS SUMMARY */}
            <div className="rounded-2xl border border-slate-200/50 bg-white/80 backdrop-blur-md p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Package className="h-4.5 w-4.5 text-blue-600" />
                      {isHe ? 'מלאי מבוקש - חמשת המוצרים המובילים' : 'High-Demand SKUs - Top 5'}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isHe ? 'סכימת סך כמויות המלאי שיצאו ללקוחות' : 'Aggregated total quantities of inventory units shipped'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {topProducts.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 font-medium">
                      {isHe ? 'אין פריטים תואמים למסננים' : 'No items matching active filters'}
                    </div>
                  ) : (
                    topProducts.map((prod, idx) => {
                      const maxVal = topProducts[0]?.qty || 1;
                      const barWidth = Math.max(5, Math.round((prod.qty / maxVal) * 100));
                      const isSelected = filterSku === prod.sku;

                      return (
                        <div 
                          key={prod.sku} 
                          onClick={() => setFilterSku(isSelected ? null : prod.sku)}
                          className={`space-y-1 cursor-pointer group transition-all ${
                            filterSku && !isSelected ? 'opacity-40 hover:opacity-100' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-700 font-black truncate max-w-[180px] flex items-center gap-1.5">
                              <span className="font-mono text-[9px] text-slate-400">#{idx+1}</span>
                              <span className="truncate">{translate(prod.name, lang)}</span>
                            </span>
                            <span className="text-slate-900 font-mono font-black">
                              {prod.qty} {isHe ? 'יח\'' : 'units'}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              style={{ width: `${barWidth}%` }}
                              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 shadow-sm"
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* COLUMN B: TOP CLIENTS BY DISPATCH CYCLES */}
            <div className="rounded-2xl border border-slate-200/50 bg-white/80 backdrop-blur-md p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Users className="h-4.5 w-4.5 text-teal-600" />
                      {isHe ? 'פעילות לקוחות - חמשת המובילים' : 'Top Clients Leaderboard'}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isHe ? 'דירוג לקוחות קבועים לפי מחזור סבבי שילוח' : 'Clients ranked by dispatch run cycles'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {topCustomers.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 font-medium">
                      {isHe ? 'אין לקוחות פעילים' : 'No active client streams'}
                    </div>
                  ) : (
                    topCustomers.map((cust, idx) => {
                      const isSelected = filterCustomer === cust.name;
                      return (
                        <div 
                          key={cust.name} 
                          onClick={() => setFilterCustomer(isSelected ? null : cust.name)}
                          className={`flex items-center justify-between text-xs border-b border-slate-100/50 pb-2.5 last:border-0 last:pb-0 cursor-pointer group transition-all ${
                            filterCustomer && !isSelected ? 'opacity-40 hover:opacity-100' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="h-5 w-5 rounded-lg bg-teal-50 text-teal-600 border border-teal-100/40 flex items-center justify-center font-mono font-black text-[10px]">
                              {idx+1}
                            </span>
                            <span className="font-extrabold text-slate-700 group-hover:text-teal-600 transition-colors">
                              {cust.name}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 font-semibold">
                            <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md text-[10px]">
                              {cust.count} {isHe ? 'סבבים' : 'runs'}
                            </span>
                            <span className="font-mono text-slate-400 text-[10px]">
                              ({cust.units} {isHe ? 'יח\'' : 'qty'})
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
