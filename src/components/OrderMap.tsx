import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Order, Language } from '../types';
import { MapPin, Warehouse, Package, User, DollarSign, Flame, Layers, Compass } from 'lucide-react';

// Storage key for coordinates caching of live sheets addresses
const LOCAL_STORAGE_GEO_CACHE_KEY = 'sabanos_geocoding_cache_v2';

// Geographic center coordinates of Israeli cities (for fallbacks)
const CITY_GEOLOCATIONS: Record<string, [number, number]> = {
  'ירושלים': [31.7683, 35.2137],
  'תל אביב': [32.0853, 34.7818],
  'חיפה': [32.7940, 34.9896],
  'אשדוד': [31.8044, 34.6553],
  'באר שבע': [31.2530, 34.7915],
  'מודיעין': [31.8903, 35.0104],
  'ראשון לציון': [31.9730, 34.7925],
  'חולון': [32.0158, 34.7874],
  'פתח תקווה': [32.0840, 34.8878],
  'נתניה': [32.3215, 34.8532],
  'חדרה': [32.4340, 34.9197],
  'אילת': [29.5577, 34.9519],
  'שוהם': [31.9994, 34.9431],
  'קיסריה': [32.5186, 34.9042],
  'רמת גן': [32.0684, 34.8248],
  'רחובות': [31.8928, 34.8113],
  'כפר סבא': [32.1782, 34.9076],
  'רעננה': [32.1848, 34.8713],
  'הרצליה': [32.1624, 34.8447],
  'אחר': [32.0800, 34.7800]
};

// Precise building-level GPS coordinates (exact pinpointing for mock addresses)
const PRECISE_ADDRESS_GEOLOCATIONS: Record<string, [number, number]> = {
  'החרש 14, אזור התעשייה תל אביב': [32.053452, 34.781898],
  'החרש 14, תל אביב': [32.053452, 34.781898],
  '14 hacharash st, tel aviv industrial zone': [32.053452, 34.781898],
  '14 hacharash st, tel aviv': [32.053452, 34.781898],

  'התלמיד 5, אזור תעשייה עטרות, ירושלים': [31.854215, 35.218541],
  'התלמיד 5, ירושלים': [31.854215, 35.218541],
  '5 hatalmid st, atarot industrial zone, jerusalem': [31.854215, 35.218541],
  '5 hatalmid st, jerusalem': [31.854215, 35.218541],

  'דרך השלום 42, פארק המדע חיפה': [32.784210, 34.961850],
  'דרך השלום 42, חיפה': [32.784210, 34.961850],
  '42 derech hashalom, haifa science park': [32.784210, 34.961850],
  '42 derech hashalom, haifa': [32.784210, 34.961850],

  'האורגים 8, אזור התעשייה אשדוד': [31.815410, 34.658742],
  'האורגים 8, אשדוד': [31.815410, 34.658742],
  '8 haoregim st, ashdod industrial zone': [31.815410, 34.658742],
  '8 haoregim st, ashdod': [31.815410, 34.658742],

  'התעשייה 21, עמק שרה, באר שבע': [31.229520, 34.820810],
  'התעשייה 21, באר שבע': [31.229520, 34.820810],
  '21 hataasiya st, emek sara, beer sheva': [31.229520, 34.820810],
  '21 hataasiya st, beer sheva': [31.229520, 34.820810],

  'שדרות המקצועות 12, מודיעין פארק טכנולוגי': [31.899430, 34.969820],
  'שדרות המקצועות 12, מודיעין': [31.899430, 34.969820],
  '12 sderot hamikzoat, modiin tech park': [31.899430, 34.969820],
  '12 sderot hamikzoat, modiin': [31.899430, 34.969820],

  'הרצל 105, ראשון לציון': [31.964520, 34.801830],
  '105 herzl st, rishon lezion': [31.964520, 34.801830],

  'המסגר 9, חולון אזור תעשייה': [32.008410, 34.803712],
  'המסגר 9, חולון': [32.008410, 34.803712],
  '9 hamasgar st, holon industrial zone': [32.008410, 34.803712],
  '9 hamasgar st, holon': [32.008410, 34.803712],

  'חצוצרה 1, הוד השרון': [32.158140, 34.896440],
  'חצוצרה 1 הוד השרון': [32.158140, 34.896440],
  '1 chatzotzra, hod hasharon': [32.158140, 34.896440],
  '1 chatzotzra st, hod hasharon': [32.158140, 34.896440],
};

// Precise Warehouse origin locations
const WAREHOUSE_GEOLOCATIONS: Record<string, [number, number]> = {
  'מחסן התלמיד': [32.0910, 34.8850],
  'מחסן החרש': [32.053452, 34.781898] // aligned with the real HaCharash building node
};

// Helper to resolve city name from address string
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

  const segments = address.split(',').map(s => s.trim());
  for (const segment of segments) {
    if (!segment) continue;
    if (knownCities.includes(segment)) {
      return segment;
    }
    for (const city of knownCities) {
      if (segment.includes(city)) {
        return city;
      }
    }
    const lowerSegment = segment.toLowerCase();
    if (englishCities[lowerSegment]) {
      return englishCities[lowerSegment];
    }
  }

  const normalized = address.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  for (const city of knownCities) {
    if (normalized.includes(city)) {
      return city;
    }
  }

  const lowerAddress = normalized.toLowerCase();
  for (const [eng, heb] of Object.entries(englishCities)) {
    if (lowerAddress.includes(eng)) {
      return heb;
    }
  }

  return 'אחר';
}

// Check if an address has predefined exact coordinates
function findPredefinedCoordinates(address: string): [number, number] | null {
  if (!address) return null;
  const normalized = address.toLowerCase().replace(/\s+/g, ' ').trim();
  
  for (const [key, coords] of Object.entries(PRECISE_ADDRESS_GEOLOCATIONS)) {
    const normKey = key.toLowerCase().replace(/\s+/g, ' ').trim();
    if (normalized.includes(normKey) || normKey.includes(normalized)) {
      return coords;
    }
  }

  // Exact substring checks for street + house number combinations
  if (normalized.includes('החרש 14') || normalized.includes('hacharash 14') || normalized.includes('harash 14')) return [32.053452, 34.781898];
  if (normalized.includes('התלמיד 5') || normalized.includes('hatalmid 5') || normalized.includes('talmid 5')) return [31.854215, 35.218541];
  if (normalized.includes('דרך השלום 42') || normalized.includes('השלום 42') || normalized.includes('shalom 42')) return [32.784210, 34.961850];
  if (normalized.includes('האורגים 8') || normalized.includes('haoregim 8') || normalized.includes('oregim 8')) return [31.815410, 34.658742];
  if (normalized.includes('התעשייה 21') || normalized.includes('hataasiya 21') || normalized.includes('taasiya 21')) return [31.229520, 34.820810];
  if (normalized.includes('המקצועות 12') || normalized.includes('hamikzoat 12') || normalized.includes('mikzoat 12')) return [31.899430, 34.969820];
  if (normalized.includes('הרצל 105') || normalized.includes('herzl 105')) return [31.964520, 34.801830];
  if (normalized.includes('המסגר 9') || normalized.includes('hamasgar 9') || normalized.includes('masgar 9')) return [32.008410, 34.803712];
  if (normalized.includes('חצוצרה 1') || normalized.includes('chatzotzra 1')) return [32.158140, 34.896440];

  return null;
}

// Controller component to dynamically adjust bounds to show all markers
function MapBoundsController({ coordinates, centerTrigger }: { coordinates: [number, number][]; centerTrigger?: number }) {
  const map = useMap();

  useEffect(() => {
    if (coordinates && coordinates.length > 0) {
      if (coordinates.length === 1) {
        // Locked focused view when only one coordinate is visible
        map.setView(coordinates[0], 15, {
          animate: true,
          duration: 1.0
        });
      } else {
        const bounds = L.latLngBounds(coordinates);
        map.fitBounds(bounds, { 
          padding: [50, 50], 
          maxZoom: 14,
          animate: true,
          duration: 1.2
        });
      }
    }
  }, [coordinates, map, centerTrigger]);

  return null;
}

// Custom Leaflet DivIcon creators for beautiful map markers
const createOrderIcon = (status: string, index: number) => {
  let colorClass = 'bg-emerald-500 ring-emerald-300';
  if (status === 'pending') colorClass = 'bg-amber-500 ring-amber-300';
  if (status === 'cancelled') colorClass = 'bg-slate-400 ring-slate-200';
  if (status === 'ready' || status === 'processing') colorClass = 'bg-blue-500 ring-blue-300';
  
  return L.divIcon({
    html: `<div class="relative flex h-5 w-5 items-center justify-center">
             <span class="animate-ping absolute inline-flex h-full w-full rounded-full ${colorClass} opacity-45"></span>
             <span class="relative inline-flex rounded-full h-3.5 w-3.5 ${colorClass} ring-4 ring-white shadow-md"></span>
           </div>`,
    className: 'custom-div-icon',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

const createWarehouseIcon = (name: string) => {
  const isCharash = name.includes('החרש') || name.toLowerCase().includes('charash');
  const bgClass = isCharash ? 'bg-orange-500' : 'bg-blue-600';
  
  return L.divIcon({
    html: `<div class="relative flex h-8 w-8 items-center justify-center rounded-full ${bgClass} border-2 border-white shadow-lg text-white">
             <span class="absolute inline-flex h-full w-full rounded-full ${bgClass} opacity-20 animate-pulse"></span>
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-warehouse"><path d="M22 22H2"/><path d="M10 22V12a2 2 0 0 1 4 0v10"/><path d="m22 10-10-8L2 10"/><path d="M6 22V10"/><path d="M18 22V10"/></svg>
           </div>`,
    className: 'custom-wh-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return { label: 'בהמתנה', classes: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'delivered':
      return { label: 'סופק בהצלחה', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'cancelled':
      return { label: 'מבוטל', classes: 'bg-slate-50 text-slate-500 border-slate-200' };
    case 'processing':
    default:
      return { label: 'מוכן להפצה', classes: 'bg-blue-50 text-blue-700 border-blue-200' };
  }
};

interface OrderMapProps {
  orders: Order[];
  lang: Language;
  onFilterCity?: (cityName: string | null) => void;
  selectedCity?: string | null;
  isLoading?: boolean;
  onSelectOrderNumber?: (orderNumber: string | null) => void;
  selectedOrderNumber?: string | null;
  darkMode?: boolean;
}

// Initialize coordinates cache from local storage
const getInitialCache = (): Record<string, [number, number]> => {
  const cache: Record<string, [number, number]> = {};
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_GEO_CACHE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.entries(parsed).forEach(([addr, coords]) => {
        if (Array.isArray(coords) && coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
          cache[addr.toLowerCase().trim()] = coords as [number, number];
        }
      });
    }
  } catch (e) {
    console.warn('Failed to load geocoding cache:', e);
  }
  return cache;
};

export default function OrderMap({ orders, lang, onFilterCity, selectedCity, isLoading, onSelectOrderNumber, selectedOrderNumber, darkMode }: OrderMapProps) {
  const isHe = true; // Hardcode true for absolute Hebrew localization requirement

  const [geoCache, setGeoCache] = useState<Record<string, [number, number]>>(getInitialCache);
  const [isDensityView, setIsDensityView] = useState(false);
  const [centerTrigger, setCenterTrigger] = useState(0);

  // Background geocoding logic for any custom/live addresses not predefined
  useEffect(() => {
    const missingAddresses = orders
      .map(o => o.deliveryAddress)
      .filter((addr): addr is string => !!addr)
      .map(addr => addr.trim())
      .filter(addr => {
        const norm = addr.toLowerCase();
        return !findPredefinedCoordinates(norm) && !geoCache[norm];
      });

    const uniqueMissing = Array.from(new Set(missingAddresses));
    if (uniqueMissing.length === 0) return;

    let active = true;

    const geocodeSequential = async () => {
      const newEntries: Record<string, [number, number]> = {};
      
      for (const address of uniqueMissing) {
        if (!active) break;
        
        try {
          // 350ms delay to avoid rate-limiting OSM Nominatim servers
          await new Promise(resolve => setTimeout(resolve, 350));
          
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ', Israel')}&format=json&limit=1`;
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'SabanOS-Logistics-Platform/2.0',
              'Accept-Language': 'he'
            }
          });
          
          if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
              const lat = parseFloat(data[0].lat);
              const lon = parseFloat(data[0].lon);
              if (!isNaN(lat) && !isNaN(lon)) {
                newEntries[address.toLowerCase()] = [lat, lon];
              }
            }
          }
        } catch (err) {
          console.warn(`Geocoding error for "${address}":`, err);
        }
      }

      if (Object.keys(newEntries).length > 0 && active) {
        setGeoCache(prev => {
          const updated = { ...prev, ...newEntries };
          try {
            localStorage.setItem(LOCAL_STORAGE_GEO_CACHE_KEY, JSON.stringify(updated));
          } catch (e) {
            console.error('Failed to save geocode cache:', e);
          }
          return updated;
        });
      }
    };

    geocodeSequential();

    return () => {
      active = false;
    };
  }, [orders, geoCache]);

  // Map processed orders to pinpoint positions
  const mapPoints = useMemo(() => {
    const cityOccupancy: Record<string, number> = {};

    return orders
      .filter(o => o.status !== 'cancelled')
      .map((order, idx) => {
        const cityName = getCityFromAddress(order.deliveryAddress);
        const normAddr = order.deliveryAddress.toLowerCase().trim();

        // 1. Try order's own latitude and longitude from source
        // 2. Try predefined coordinates
        // 3. Try geocoding cache
        // 4. Fall back to city-level center
        const exactCoords = (order.latitude && order.longitude)
          ? [order.latitude, order.longitude] as [number, number]
          : (findPredefinedCoordinates(normAddr) || geoCache[normAddr]);
        const baseCoords = exactCoords || CITY_GEOLOCATIONS[cityName] || CITY_GEOLOCATIONS['אחר'];
        
        cityOccupancy[cityName] = (cityOccupancy[cityName] || 0) + 1;
        const count = cityOccupancy[cityName];

        let lat = baseCoords[0];
        let lng = baseCoords[1];

        // Apply a minor spiral jitter only if we're falling back to city-level approximations to prevent overlapping.
        // If we have precise geocoding (exact coordinates), do not offset the pin.
        if (!exactCoords && count > 1) {
          const angle = (count * 0.7) * Math.PI;
          const radius = 0.005 * Math.log(count + 1);
          lat += Math.sin(angle) * radius;
          lng += Math.cos(angle) * radius;
        }

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          deliveryAddress: order.deliveryAddress,
          warehouse: order.warehouse,
          status: order.status,
          items: order.items || [],
          itemsCount: order.items?.reduce((acc, item) => acc + (item.quantity || 0), 0) || 0,
          city: cityName,
          position: [lat, lng] as [number, number]
        };
      });
  }, [orders, geoCache]);

  // List of all coordinates to scale/zoom the map accurately
  const allGeolocations = useMemo(() => {
    const list: [number, number][] = [];
    mapPoints.forEach(p => {
      list.push(p.position);
    });
    Object.values(WAREHOUSE_GEOLOCATIONS).forEach(coords => {
      list.push(coords);
    });
    return list;
  }, [mapPoints]);

  // Coordinates of the currently visible or selected order markers to zoom/center on
  const activeCoordinates = useMemo(() => {
    if (selectedOrderNumber) {
      const selectedPoint = mapPoints.find(p => p.orderNumber === selectedOrderNumber);
      if (selectedPoint) {
        return [selectedPoint.position];
      }
    }
    if (mapPoints.length > 0) {
      return mapPoints.map(p => p.position);
    }
    return allGeolocations;
  }, [mapPoints, selectedOrderNumber, allGeolocations]);

  // Group active orders into neighborhood grids for density heatmap overlay
  const densityClusters = useMemo(() => {
    const groups: Record<string, {
      lat: number;
      lng: number;
      ordersCount: number;
      city: string;
      orderNumbers: string[];
      orders: typeof mapPoints;
    }> = {};

    mapPoints.forEach(pt => {
      // Rounded coordinates form a local grid (approx. 1.1km cells for high precision neighborhood analysis)
      const gridKey = `${pt.position[0].toFixed(2)}_${pt.position[1].toFixed(2)}`;
      if (!groups[gridKey]) {
        groups[gridKey] = {
          lat: pt.position[0],
          lng: pt.position[1],
          ordersCount: 0,
          city: pt.city,
          orderNumbers: [],
          orders: []
        };
      }
      groups[gridKey].ordersCount += 1;
      groups[gridKey].orderNumbers.push(pt.orderNumber);
      groups[gridKey].orders.push(pt);
    });

    return Object.values(groups);
  }, [mapPoints]);

  // Loading and empty states placed strictly after all React Hook declarations
  if (isLoading) {
    return (
      <div className="relative h-full w-full min-h-[420px] flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-center shadow-md font-sans" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <h3 className="text-sm font-bold text-slate-700">טוען מפת הפצה ולוגיסטיקה...</h3>
          <p className="text-xs text-slate-400">מתחבר לשרת המפות של OpenStreetMap ומסנכרן מיקומים</p>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="relative h-full w-full min-h-[420px] flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-center shadow-md font-sans" dir="rtl">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400 mb-4 border border-slate-100">
          <MapPin className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">
          אין הזמנות להצגה על המפה
        </h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          לא נמצאו משלוחים פעילים במערכת כרגע. נסה לרענן את הנתונים או להוסיף הזמנה חדשה.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full flex flex-col rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shadow-sm font-sans" dir="rtl">
      {/* Map Header with clear stats & reset button */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-100 text-xs text-right">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-bold text-slate-700">
            {isDensityView 
              ? `אנליזת עומסים: מוצגים ${densityClusters.length} אזורי הפצה שונים בפריסת נהגים` 
              : `מוצגות ${mapPoints.length} הזמנות פעילות בפריסה ארצית מדויקת`
            }
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Density View Toggle */}
          <button
            onClick={() => setIsDensityView(!isDensityView)}
            className={`flex items-center gap-1.5 text-[10px] font-black rounded-lg px-3 py-1.5 border transition-all cursor-pointer ${
              isDensityView 
                ? 'bg-amber-500 text-white border-amber-600 shadow-sm shadow-amber-500/10'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title={isDensityView ? 'הצג סיכות רגילות' : 'הצג עומס הפצה מרוכז'}
          >
            {isDensityView ? (
              <>
                <Layers className="h-3.5 w-3.5 text-white animate-spin" style={{ animationDuration: '3s' }} />
                <span>סיכות רגילות</span>
              </>
            ) : (
              <>
                <Flame className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                <span>תצוגת עומסי הפצה (מפת חום)</span>
              </>
            )}
          </button>

          {/* Center on Active Button */}
          <button
            onClick={() => setCenterTrigger(prev => prev + 1)}
            className="flex items-center gap-1.5 text-[10px] font-black rounded-lg px-3 py-1.5 border bg-white text-slate-700 border-slate-200 hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
            title="מרכז תצוגה על משלוחים פעילים"
          >
            <Compass className="h-3.5 w-3.5 text-blue-600" />
            <span>{selectedOrderNumber ? 'התמקדות במשלוח הנבחר' : 'מרכז תצוגת משלוחים'}</span>
          </button>

          {selectedCity && (
            <button
              onClick={() => onFilterCity?.(null)}
              className="text-[10px] font-black text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-lg px-3 py-1.5 transition-all cursor-pointer"
            >
              בטל סינון ({selectedCity})
            </button>
          )}
        </div>
      </div>

      {/* Map Viewport Area */}
      <div className="relative flex-1 min-h-[420px] w-full z-0">
        <MapContainer
          center={[31.5, 34.75]}
          zoom={8}
          scrollWheelZoom={true}
          className="h-full w-full"
          style={{ height: '100%', width: '100%' }}
        >
          {/* TileLayer utilizing standard OpenStreetMap tiles so Israel labels and streets render natively in Hebrew */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url={darkMode 
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            }
          />

          {/* Dynamic Map bounds controller */}
          <MapBoundsController coordinates={activeCoordinates} centerTrigger={centerTrigger} />

          {/* Render Warehouse Origins */}
          {Object.entries(WAREHOUSE_GEOLOCATIONS).map(([name, coords]) => (
            <Marker
              key={`wh-node-${name}`}
              position={coords}
              icon={createWarehouseIcon(name)}
            >
              <Popup closeButton={false}>
                <div className="p-1 font-sans text-right" dir="rtl">
                  <div className="flex items-center gap-1.5 font-extrabold text-slate-900 border-b border-slate-100 pb-1 mb-1.5">
                    <Warehouse className="h-4 w-4 text-blue-600" />
                    <span>{name}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold">
                    מרכז הפצה ולוגיסטיקה ראשי - SabanOS
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Density Heatmap View Overlay */}
          {isDensityView && densityClusters.map((cluster, idx) => {
            const isHigh = cluster.ordersCount >= 3;
            const isMed = cluster.ordersCount === 2;
            const heatColor = isHigh ? '#ef4444' : isMed ? '#f59e0b' : '#3b82f6';
            
            return (
              <React.Fragment key={`density-cluster-${idx}`}>
                {/* Outer Ambient Glow Ring */}
                <Circle
                  center={[cluster.lat, cluster.lng]}
                  radius={1200 + Math.min(cluster.ordersCount, 10) * 400}
                  pathOptions={{
                    color: heatColor,
                    fillColor: heatColor,
                    fillOpacity: 0.12,
                    weight: 1,
                    dashArray: '5, 8'
                  }}
                />
                
                {/* Inner Dense Core */}
                <Circle
                  center={[cluster.lat, cluster.lng]}
                  radius={400 + Math.min(cluster.ordersCount, 10) * 150}
                  pathOptions={{
                    color: heatColor,
                    fillColor: heatColor,
                    fillOpacity: 0.38,
                    weight: 1.5
                  }}
                >
                  <Popup closeButton={false}>
                    <div className="p-3 font-sans text-right min-w-[240px]" dir="rtl">
                      {/* Title */}
                      <div className="border-b border-slate-100 pb-2 mb-2">
                        <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 justify-start">
                          <Flame className="h-4 w-4 text-amber-500 shrink-0" />
                          <span>אזור צפיפות הפצה: {cluster.city}</span>
                        </span>
                      </div>

                      {/* Stats */}
                      <div className="space-y-2 text-[11px] text-slate-600 font-medium">
                        <div className="flex justify-between items-center border-b border-slate-50 pb-1">
                          <span>נפח הזמנות פעיל:</span>
                          <span className="font-black text-slate-900 bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100">
                            {cluster.ordersCount} משלוחים
                          </span>
                        </div>

                        <div className="flex justify-between items-center border-b border-slate-50 pb-1">
                          <span>רמת עומס (שכונה):</span>
                          <span className={`font-extrabold px-2 py-0.5 rounded ${
                            isHigh 
                              ? 'bg-rose-50 text-rose-700 border border-rose-100 animate-pulse' 
                              : isMed 
                              ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                              : 'bg-blue-50 text-blue-700 border border-blue-100'
                          }`}>
                            {isHigh ? 'צפיפות קריטית' : isMed ? 'עומס בינוני' : 'נמוך / מפוזר'}
                          </span>
                        </div>

                        {/* Load balancing recommendation */}
                        <div className="bg-slate-50 rounded p-2 text-[10px] text-slate-500 border border-slate-100">
                          <strong className="text-slate-700 block mb-0.5">המלצת איזון עומסים:</strong>
                          {isHigh ? (
                            <span className="text-rose-600 font-bold leading-relaxed">מומלץ לפצל את הכתובות באזור זה בין 2 נהגי הפצה שונים כדי למנוע עיכובים במסירה.</span>
                          ) : isMed ? (
                            <span className="text-amber-600 font-bold leading-relaxed">ניתן לשלוח נהג בודד עם קו מרוכז במיוחד, תוך שימת לב לחלון זמני מסירה.</span>
                          ) : (
                            <span className="leading-relaxed">קבוצת הפצה מיטבית. נהג יחיד יבצע סבב מסירות מלא בזמן קצר ובצורה יעילה.</span>
                          )}
                        </div>

                        {/* List of order IDs in cluster */}
                        <div className="pt-1">
                          <span className="text-[10px] text-slate-400 block mb-1">משלוחים הכלולים באשכול זה:</span>
                          <div className="flex flex-wrap gap-1 max-h-[60px] overflow-y-auto">
                            {cluster.orders.map(o => (
                              <button
                                key={o.id}
                                onClick={() => onSelectOrderNumber?.(o.orderNumber)}
                                className="text-[9px] font-mono font-bold bg-white hover:bg-blue-600 hover:text-white border border-slate-200 rounded px-1.5 py-0.5 transition-all cursor-pointer"
                                title="הצג בלוח סידור"
                              >
                                #{o.orderNumber}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Circle>
              </React.Fragment>
            );
          })}

          {/* Render Order Pinpoints (Standard View) */}
          {!isDensityView && mapPoints.map((pt, idx) => (
            <Marker
              key={`order-pin-${pt.id}-${idx}`}
              position={pt.position}
              icon={createOrderIcon(pt.status, idx)}
              eventHandlers={{
                click: () => {
                  // Click triggers state filter to isolate this order in the dashboard list
                  onSelectOrderNumber?.(pt.orderNumber);
                }
              }}
            >
              {/* Interactive Hover Tooltip */}
              <Tooltip direction="top" offset={[0, -10]} opacity={0.98} sticky={true}>
                <div className="font-sans text-right p-1.5 min-w-[160px]" dir="rtl">
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <span className="font-extrabold text-slate-900 text-[10px]">הזמנה #{pt.orderNumber}</span>
                    <span className={`text-[8px] px-1 py-0.2 rounded border font-black ${getStatusBadge(pt.status).classes}`}>
                      {getStatusBadge(pt.status).label}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-700 font-bold space-y-0.5">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[110px]">{pt.customerName}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-500">
                      <MapPin className="h-3 w-3 text-rose-500 shrink-0" />
                      <span className="truncate max-w-[110px]">{pt.deliveryAddress}</span>
                    </div>
                  </div>
                </div>
              </Tooltip>

              <Popup closeButton={false}>
                <div className="p-3 font-sans text-right min-w-[220px]" dir="rtl">
                  {/* Header */}
                  <div className="border-b border-slate-100 pb-2 mb-2">
                    <span className="font-extrabold text-slate-900 text-xs block">
                      מספר הזמנה: #{pt.orderNumber}
                    </span>
                  </div>

                  {/* Body Info */}
                  <div className="space-y-2 text-[11px] text-slate-600 font-medium">
                    <div className="flex items-center gap-2 justify-start">
                      <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>לקוח קצה: <strong className="text-slate-900 font-extrabold">{pt.customerName}</strong></span>
                    </div>

                    <div className="flex items-start gap-2 justify-start">
                      <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <span>כתובת למשלוח: <strong className="text-slate-800 font-bold leading-normal">{pt.deliveryAddress}</strong></span>
                    </div>

                    <div className="flex items-center gap-2 justify-start">
                      <Package className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>כמות פריטים: <strong className="text-slate-900 font-black">{pt.itemsCount} יחידות</strong></span>
                    </div>
                  </div>

                  {/* CTA button inside Popup */}
                  <button
                    onClick={() => onSelectOrderNumber?.(pt.orderNumber)}
                    className="w-full mt-3 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg py-1.5 px-2.5 text-[10px] font-black hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all text-center block shadow-sm cursor-pointer"
                  >
                    הצג והדגש בלוח הסידור ➔
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Map Legend Hud */}
      <div className="bg-white border-t border-slate-100 px-4 py-2.5 text-[10px] text-slate-500 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600"></span>
            <span className="font-bold text-slate-700">מחסן התלמיד</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500"></span>
            <span className="font-bold text-slate-700">מחסן החרש</span>
          </div>

          {isDensityView ? (
            <>
              <div className="flex items-center gap-1.5 border-r border-slate-200 pr-3.5 mr-1 animate-fade-in">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 border border-white shadow-sm"></span>
                <span className="font-extrabold text-slate-700">צפיפות קריטית (3+ הזמנות בקילומטר)</span>
              </div>
              <div className="flex items-center gap-1.5 animate-fade-in">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 border border-white shadow-sm"></span>
                <span className="font-extrabold text-slate-700">עומס בינוני (2 הזמנות בקילומטר)</span>
              </div>
              <div className="flex items-center gap-1.5 animate-fade-in">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500 border border-white shadow-sm"></span>
                <span className="font-extrabold text-slate-700">נפח מפוזר (הזמנה בודדת בקילומטר)</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 border-r border-slate-200 pr-3.5 mr-1">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500 border border-white shadow-sm"></span>
                <span>מוכן להפצה / בטיפול</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 border border-white shadow-sm"></span>
                <span>בהמתנה</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 border border-white shadow-sm"></span>
                <span>סופק</span>
              </div>
            </>
          )}
        </div>
        <div>
          <span className="font-bold text-slate-400">
            {isDensityView ? 'מצב אנליזת עומסים ואיזון קווים' : 'מפת הפצה לוגיסטית אינטראקטיבית SabanOS'}
          </span>
        </div>
      </div>
    </div>
  );
}
