import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Tooltip, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { Order, Language } from '../types';
import { 
  MapPin, 
  Warehouse, 
  Package, 
  User, 
  Flame, 
  Layers, 
  Compass, 
  Navigation, 
  Route, 
  Ruler, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  Truck,
  Activity,
  ArrowLeftRight,
  Maximize2
} from 'lucide-react';

// Storage key for coordinates caching of live sheets addresses
const LOCAL_STORAGE_GEO_CACHE_KEY = 'sabanos_geocoding_cache_v2';

// Precise Warehouse origin locations
const WAREHOUSE_GEOLOCATIONS: Record<string, [number, number]> = {
  'מחסן החרש': [32.053452, 34.781898],
  'מחסן התלמיד': [31.854215, 35.218541],
  'מחסן ראשי': [32.053452, 34.781898]
};

const DEFAULT_WAREHOUSE_COORDS: [number, number] = [32.053452, 34.781898]; // HaCharash 14, Tel Aviv

// Geographic center coordinates of Israeli cities (for instant geocoding fallback)
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
  'עפולה': [32.6072, 35.2897],
  'עכו': [32.9272, 35.0817],
  'טבריה': [32.7922, 35.5312],
  'נהריה': [33.0059, 35.0941],
  'בית שמש': [31.7470, 34.9881],
  'קריית גת': [31.6100, 34.7642],
  'אחר': [32.0800, 34.7800]
};

// Known exact address pinpoint mapping
const PRECISE_ADDRESS_GEOLOCATIONS: Record<string, [number, number]> = {
  'החרש 14, תל אביב': [32.053452, 34.781898],
  'התלמיד 5, ירושלים': [31.854215, 35.218541],
  'דרך השלום 42, חיפה': [32.784210, 34.961850],
  'האורגים 8, אשדוד': [31.815410, 34.658742],
  'התעשייה 21, באר שבע': [31.229520, 34.820810],
  'שדרות המקצועות 12, מודיעין': [31.899430, 34.969820],
  'הרצל 105, ראשון לציון': [31.964520, 34.801830],
  'המסגר 9, חולון': [32.008410, 34.803712],
  'חצוצרה 1, הוד השרון': [32.158140, 34.896440]
};

/**
  Haversine Distance Formula (straight line) + Road factor multiplier (~1.22x)
 */
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): { straightKm: number; roadKm: number } {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightKm = R * c;
  const roadKm = straightKm * 1.22; // Road route factor estimation
  return {
    straightKm: Math.round(straightKm * 10) / 10,
    roadKm: Math.round(roadKm * 10) / 10
  };
}

// Extract City Name helper
function getCityFromAddress(address: string): string {
  if (!address) return 'אחר';
  const knownCities = Object.keys(CITY_GEOLOCATIONS);

  const segments = address.split(',').map(s => s.trim());
  for (const segment of segments) {
    if (!segment) continue;
    for (const city of knownCities) {
      if (segment.includes(city)) return city;
    }
  }

  const normalized = address.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  for (const city of knownCities) {
    if (normalized.includes(city)) return city;
  }

  return 'אחר';
}

function findPredefinedCoordinates(address: string): [number, number] | null {
  if (!address) return null;
  const normalized = address.toLowerCase().replace(/\s+/g, ' ').trim();

  for (const [key, coords] of Object.entries(PRECISE_ADDRESS_GEOLOCATIONS)) {
    const normKey = key.toLowerCase().replace(/\s+/g, ' ').trim();
    if (normalized.includes(normKey) || normKey.includes(normalized)) {
      return coords;
    }
  }
  return null;
}

// Controller component to dynamically adjust map view bounds
function MapBoundsController({ coordinates, centerTrigger }: { coordinates: [number, number][]; centerTrigger?: number }) {
  const map = useMap();

  useEffect(() => {
    if (coordinates && coordinates.length > 0) {
      if (coordinates.length === 1) {
        map.setView(coordinates[0], 15, {
          animate: true,
          duration: 0.8
        });
      } else {
        const bounds = L.latLngBounds(coordinates);
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 13,
          animate: true,
          duration: 1.0
        });
      }
    }
  }, [coordinates, map, centerTrigger]);

  return null;
}

// Custom Leaflet DivIcon creators
const createOrderIcon = (status: string, isSelected: boolean) => {
  let colorClass = 'bg-emerald-500 ring-emerald-300';
  if (status === 'pending') colorClass = 'bg-amber-500 ring-amber-300';
  if (status === 'cancelled') colorClass = 'bg-slate-400 ring-slate-200';
  if (status === 'ready' || status === 'processing') colorClass = 'bg-blue-500 ring-blue-300';

  const scaleClass = isSelected ? 'scale-125 z-50' : 'scale-100';

  return L.divIcon({
    html: `<div class="relative flex h-6 w-6 items-center justify-center transition-all ${scaleClass}">
             <span class="animate-ping absolute inline-flex h-full w-full rounded-full ${colorClass} opacity-40"></span>
             <span class="relative inline-flex rounded-full h-4 w-4 ${colorClass} ring-4 ring-white shadow-lg"></span>
           </div>`,
    className: 'custom-div-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const createWarehouseIcon = (name: string) => {
  const isCharash = name.includes('החרש') || name.toLowerCase().includes('charash');
  const bgClass = isCharash ? 'bg-orange-600' : 'bg-blue-600';

  return L.divIcon({
    html: `<div class="relative flex h-9 w-9 items-center justify-center rounded-full ${bgClass} border-2 border-white shadow-xl text-white">
             <span class="absolute inline-flex h-full w-full rounded-full ${bgClass} opacity-25 animate-pulse"></span>
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-warehouse"><path d="M22 22H2"/><path d="M10 22V12a2 2 0 0 1 4 0v10"/><path d="m22 10-10-8L2 10"/><path d="M6 22V10"/><path d="M18 22V10"/></svg>
           </div>`,
    className: 'custom-wh-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return { label: 'בהמתנה', classes: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    case 'delivered':
      return { label: 'סופק בהצלחה', classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    case 'cancelled':
      return { label: 'מבוטל', classes: 'bg-slate-500/10 text-slate-400 border-slate-500/30' };
    case 'processing':
    default:
      return { label: 'מוכן להפצה', classes: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
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

export default function OrderMap({
  orders,
  lang,
  onFilterCity,
  selectedCity,
  isLoading,
  onSelectOrderNumber,
  selectedOrderNumber,
  darkMode = true
}: OrderMapProps) {
  const isHe = true; // Hebrew default

  const [geoCache, setGeoCache] = useState<Record<string, [number, number]>>(getInitialCache);
  const [isDensityView, setIsDensityView] = useState(false);
  const [centerTrigger, setCenterTrigger] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');
  const [isGeocodingActive, setIsGeocodingActive] = useState(false);
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null);

  // Background geocoding logic for missing order addresses using Nominatim API
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
    setIsGeocodingActive(true);

    const geocodeSequential = async () => {
      const newEntries: Record<string, [number, number]> = {};

      for (const address of uniqueMissing) {
        if (!active) break;

        try {
          await new Promise(resolve => setTimeout(resolve, 400)); // Respect OSMM rate limit

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
      if (active) {
        setIsGeocodingActive(false);
      }
    };

    geocodeSequential();

    return () => {
      active = false;
    };
  }, [orders, geoCache]);

  // Process live order data into pinpoint positions with distance calculation
  const mapPoints = useMemo(() => {
    const cityOccupancy: Record<string, number> = {};

    return orders
      .filter(o => o.status !== 'cancelled')
      .map((order, idx) => {
        const cityName = getCityFromAddress(order.deliveryAddress || '');
        const normAddr = (order.deliveryAddress || '').toLowerCase().trim();

        // 1. Order's own latitude and longitude
        // 2. Predefined coordinates
        // 3. Geocoding cache
        // 4. City-level center fallback
        const exactCoords = (order.latitude && order.longitude)
          ? [order.latitude, order.longitude] as [number, number]
          : (findPredefinedCoordinates(normAddr) || geoCache[normAddr]);

        const baseCoords = exactCoords || CITY_GEOLOCATIONS[cityName] || CITY_GEOLOCATIONS['אחר'];

        cityOccupancy[cityName] = (cityOccupancy[cityName] || 0) + 1;
        const count = cityOccupancy[cityName];

        let lat = baseCoords[0];
        let lng = baseCoords[1];

        // Minor spiral jitter ONLY for city-level fallbacks to prevent overlapping pins
        if (!exactCoords && count > 1) {
          const angle = (count * 0.7) * Math.PI;
          const radius = 0.005 * Math.log(count + 1);
          lat += Math.sin(angle) * radius;
          lng += Math.cos(angle) * radius;
        }

        // Warehouse origin
        const whName = order.warehouse || 'מחסן החרש';
        const whCoords = WAREHOUSE_GEOLOCATIONS[whName] || DEFAULT_WAREHOUSE_COORDS;

        // Calculate accurate distance
        const { straightKm, roadKm } = calculateDistanceKm(whCoords[0], whCoords[1], lat, lng);

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          deliveryAddress: order.deliveryAddress,
          warehouse: whName,
          warehouseCoords: whCoords,
          status: order.status,
          items: order.items || [],
          itemsCount: order.items?.reduce((acc, item) => acc + (item.quantity || 0), 0) || 0,
          totalAmount: order.totalAmount || 0,
          city: cityName,
          position: [lat, lng] as [number, number],
          straightKm,
          roadKm,
          isGeocodedExact: !!exactCoords
        };
      });
  }, [orders, geoCache]);

  // Filter map points by search query
  const filteredPoints = useMemo(() => {
    if (!searchFilter.trim()) return mapPoints;
    const q = searchFilter.toLowerCase().trim();
    return mapPoints.filter(p =>
      p.orderNumber.toLowerCase().includes(q) ||
      p.customerName.toLowerCase().includes(q) ||
      p.deliveryAddress.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q)
    );
  }, [mapPoints, searchFilter]);

  // Map statistics summary
  const distanceStats = useMemo(() => {
    if (mapPoints.length === 0) return { totalKm: 0, avgKm: 0, maxKm: 0, count: 0 };
    const totalKm = Math.round(mapPoints.reduce((acc, p) => acc + p.roadKm, 0));
    const avgKm = Math.round((totalKm / mapPoints.length) * 10) / 10;
    const maxKm = Math.max(...mapPoints.map(p => p.roadKm));
    return {
      totalKm,
      avgKm,
      maxKm,
      count: mapPoints.length
    };
  }, [mapPoints]);

  // Active coordinates for map zooming
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
    return Object.values(WAREHOUSE_GEOLOCATIONS);
  }, [mapPoints, selectedOrderNumber]);

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

  if (isLoading) {
    return (
      <div className="relative h-[600px] w-full flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center shadow-2xl font-sans" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <Truck className="h-6 w-6 text-blue-400 absolute inset-0 m-auto" />
          </div>
          <h3 className="text-base font-bold text-slate-100">טוען מפת הפצה ולוגיסטיקה SabanOS...</h3>
          <p className="text-xs text-slate-400 max-w-md">
            מבצע פענוח קואורדינטות בזמן אמת וסנכרון נתוני מרחקי משלוח
          </p>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="relative h-[600px] w-full flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center shadow-2xl font-sans text-white" dir="rtl">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-slate-400 mb-4 border border-slate-800 shadow-inner">
          <MapPin className="h-7 w-7 text-slate-500" />
        </div>
        <h3 className="text-base font-bold text-slate-200">
          אין משלוחים פעילים להצגה על המפה
        </h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          לא נמצאו הזמנות הממתינות להפצה. הוסף הזמנה חדשה בסידור או רענן את הנתונים.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 overflow-hidden shadow-2xl font-sans flex flex-col lg:flex-row h-[700px]" dir="rtl">
      
      {/* Left/Main Section: Map Container & Header */}
      <div className="flex-1 flex flex-col h-full min-h-0 relative">
        
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900/90 border-b border-slate-800 text-xs backdrop-blur-md z-10">
          
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <div>
              <span className="font-extrabold text-slate-100 text-sm flex items-center gap-2">
                <span>מפת הפצה וניתוח מרחקים</span>
                <span className="text-[10px] font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  {distanceStats.count} יעדים
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Geocoding Indicator */}
            {isGeocodingActive && (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg animate-pulse">
                <Compass className="h-3.5 w-3.5 animate-spin" />
                <span>מפענח כתובות בזמן אמת...</span>
              </span>
            )}

            {/* Density Toggle */}
            <button
              onClick={() => setIsDensityView(!isDensityView)}
              className={`flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-3 py-1.5 border transition-all cursor-pointer ${
                isDensityView
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-lg shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {isDensityView ? (
                <>
                  <Layers className="h-3.5 w-3.5 text-slate-950" />
                  <span>סיכות רגילות</span>
                </>
              ) : (
                <>
                  <Flame className="h-3.5 w-3.5 text-amber-400" />
                  <span>עומס הפצה (מפת חום)</span>
                </>
              )}
            </button>

            {/* Center View */}
            <button
              onClick={() => setCenterTrigger(prev => prev + 1)}
              className="flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-3 py-1.5 border bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 transition-all cursor-pointer"
              title="מרכז מפה"
            >
              <Compass className="h-3.5 w-3.5 text-blue-400" />
              <span>{selectedOrderNumber ? 'התמקדות בנבחר' : 'מרכז מפה'}</span>
            </button>

            {selectedCity && (
              <button
                onClick={() => onFilterCity?.(null)}
                className="text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2.5 py-1 hover:bg-rose-500/20 transition-all cursor-pointer"
              >
                בטל סינון ({selectedCity})
              </button>
            )}
          </div>
        </div>

        {/* Leaflet Map Viewport */}
        <div className="relative flex-1 w-full z-0 bg-slate-900">
          <MapContainer
            center={[31.5, 34.75]}
            zoom={8}
            scrollWheelZoom={true}
            className="h-full w-full"
            style={{ height: '100%', width: '100%' }}
          >
            {/* Tile Layer */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url={darkMode
                ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              }
            />

            {/* Dynamic Map Bounds */}
            <MapBoundsController coordinates={activeCoordinates} centerTrigger={centerTrigger} />

            {/* Render Warehouses */}
            {Object.entries(WAREHOUSE_GEOLOCATIONS).map(([name, coords]) => (
              <Marker
                key={`wh-node-${name}`}
                position={coords}
                icon={createWarehouseIcon(name)}
              >
                <Popup closeButton={false}>
                  <div className="p-2 font-sans text-right" dir="rtl">
                    <div className="flex items-center gap-1.5 font-extrabold text-slate-900 border-b border-slate-200 pb-1 mb-1">
                      <Warehouse className="h-4 w-4 text-blue-600" />
                      <span>{name}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 font-bold">
                      מרכז הפצה ולוגיסטיקה ראשי - SabanOS
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Route Connection Polylines (For hovered or selected orders) */}
            {mapPoints.map(pt => {
              const isSelected = selectedOrderNumber === pt.orderNumber;
              const isHovered = hoveredOrderId === pt.id;
              if (!isSelected && !isHovered) return null;

              return (
                <Polyline
                  key={`route-line-${pt.id}`}
                  positions={[pt.warehouseCoords, pt.position]}
                  pathOptions={{
                    color: isSelected ? '#3b82f6' : '#10b981',
                    weight: 3,
                    dashArray: '6, 8',
                    opacity: 0.85
                  }}
                />
              );
            })}

            {/* Density View */}
            {isDensityView && densityClusters.map((cluster, idx) => {
              const isHigh = cluster.ordersCount >= 3;
              const isMed = cluster.ordersCount === 2;
              const heatColor = isHigh ? '#ef4444' : isMed ? '#f59e0b' : '#3b82f6';

              return (
                <React.Fragment key={`density-cluster-${idx}`}>
                  <Circle
                    center={[cluster.lat, cluster.lng]}
                    radius={1200 + Math.min(cluster.ordersCount, 10) * 400}
                    pathOptions={{
                      color: heatColor,
                      fillColor: heatColor,
                      fillOpacity: 0.15,
                      weight: 1,
                      dashArray: '5, 8'
                    }}
                  />
                  <Circle
                    center={[cluster.lat, cluster.lng]}
                    radius={400 + Math.min(cluster.ordersCount, 10) * 150}
                    pathOptions={{
                      color: heatColor,
                      fillColor: heatColor,
                      fillOpacity: 0.45,
                      weight: 2
                    }}
                  >
                    <Popup closeButton={false}>
                      <div className="p-3 font-sans text-right min-w-[220px]" dir="rtl">
                        <div className="border-b border-slate-200 pb-1.5 mb-1.5">
                          <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1">
                            <Flame className="h-4 w-4 text-amber-500" />
                            <span>אזור צפיפות: {cluster.city}</span>
                          </span>
                        </div>
                        <div className="space-y-1 text-[11px] text-slate-700 font-medium">
                          <div className="flex justify-between">
                            <span>משלוחים באזור:</span>
                            <strong className="text-slate-900">{cluster.ordersCount}</strong>
                          </div>
                          <div className="pt-1 flex flex-wrap gap-1">
                            {cluster.orders.map(o => (
                              <button
                                key={o.id}
                                onClick={() => onSelectOrderNumber?.(o.orderNumber)}
                                className="text-[9px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5"
                              >
                                #{o.orderNumber}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Circle>
                </React.Fragment>
              );
            })}

            {/* Standard Markers */}
            {!isDensityView && mapPoints.map((pt) => {
              const isSelected = selectedOrderNumber === pt.orderNumber;

              return (
                <Marker
                  key={`order-pin-${pt.id}`}
                  position={pt.position}
                  icon={createOrderIcon(pt.status, isSelected)}
                  eventHandlers={{
                    click: () => onSelectOrderNumber?.(pt.orderNumber),
                    mouseover: () => setHoveredOrderId(pt.id),
                    mouseout: () => setHoveredOrderId(null)
                  }}
                >
                  <Tooltip direction="top" offset={[0, -12]} opacity={0.98} sticky={true}>
                    <div className="font-sans text-right p-1.5 min-w-[170px]" dir="rtl">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-extrabold text-slate-900 text-[11px]">#{pt.orderNumber}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-black border ${getStatusBadge(pt.status).classes}`}>
                          {getStatusBadge(pt.status).label}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-700 font-bold space-y-0.5">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-500" />
                          <span className="truncate max-w-[120px]">{pt.customerName}</span>
                        </div>
                        <div className="flex items-center justify-between text-blue-700 font-extrabold pt-0.5 border-t border-slate-100 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Ruler className="h-3 w-3" />
                            <span>מרחק נסיעה:</span>
                          </span>
                          <span className="font-mono bg-blue-50 px-1 rounded">{pt.roadKm} ק"מ</span>
                        </div>
                      </div>
                    </div>
                  </Tooltip>

                  <Popup closeButton={false}>
                    <div className="p-3 font-sans text-right min-w-[230px]" dir="rtl">
                      <div className="border-b border-slate-200 pb-2 mb-2 flex items-center justify-between">
                        <span className="font-extrabold text-slate-900 text-xs">
                          הזמנה #{pt.orderNumber}
                        </span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${getStatusBadge(pt.status).classes}`}>
                          {getStatusBadge(pt.status).label}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-[11px] text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span>לקוח: <strong className="text-slate-900 font-bold">{pt.customerName}</strong></span>
                        </div>

                        <div className="flex items-start gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <span>כתובת: <strong className="text-slate-900 font-bold">{pt.deliveryAddress}</strong></span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Warehouse className="h-3.5 w-3.5 text-blue-600" />
                          <span>יציאה מ: <strong className="text-slate-900 font-bold">{pt.warehouse}</strong></span>
                        </div>

                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200 mt-2">
                          <span className="flex items-center gap-1 text-slate-600 font-bold">
                            <Route className="h-3.5 w-3.5 text-blue-600" />
                            <span>מרחק מחושב:</span>
                          </span>
                          <span className="font-mono font-black text-blue-700 text-xs">
                            {pt.roadKm} ק"מ
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => onSelectOrderNumber?.(pt.orderNumber)}
                        className="w-full mt-3 bg-blue-600 text-white rounded-lg py-1.5 px-2 text-[10px] font-bold hover:bg-blue-700 transition-all text-center block shadow-sm cursor-pointer"
                      >
                        הצג והדגש בלוח הסידור ➔
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Map Footer Hud */}
        <div className="bg-slate-900 border-t border-slate-800 px-4 py-2 text-[10px] text-slate-400 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500"></span>
              <span className="font-bold text-slate-300">מוכן להפצה</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              <span className="font-bold text-slate-300">בהמתנה</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="font-bold text-slate-300">סופק</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Ruler className="h-3.5 w-3.5 text-blue-400" />
            <span className="font-bold text-slate-300">
              מחשב מרחקים אוטומטי נקודתי למחסן היציאה
            </span>
          </div>
        </div>
      </div>

      {/* Right Section: Distance & Destinations Live Panel */}
      <div className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-r border-slate-800 flex flex-col h-full overflow-hidden shrink-0">
        
        {/* Panel Header */}
        <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-900/80">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-slate-100 flex items-center gap-2">
              <Route className="h-4 w-4 text-blue-400" />
              <span>יעדי משלוח וניתוח מרחק</span>
            </h4>
            <span className="text-[10px] font-mono font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
              KM ROUTER
            </span>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-2 text-right">
            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">סה"כ קילומטראז'</span>
              <span className="text-base font-black font-mono text-emerald-400">{distanceStats.totalKm} ק"מ</span>
            </div>
            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">ממוצע למשלוח</span>
              <span className="text-base font-black font-mono text-blue-400">{distanceStats.avgKm} ק"מ</span>
            </div>
          </div>

          {/* Live Filter Input */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-500 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="סינון לפי לקוח, כתובת או מס'..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        {/* Scrollable Destination Order List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-slate-800/50">
          {filteredPoints.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              לא נמצאו משלוחים תואמים לחיפוש
            </div>
          ) : (
            filteredPoints.map((pt) => {
              const isSelected = selectedOrderNumber === pt.orderNumber;

              return (
                <div
                  key={`dest-card-${pt.id}`}
                  onClick={() => onSelectOrderNumber?.(pt.orderNumber)}
                  onMouseEnter={() => setHoveredOrderId(pt.id)}
                  onMouseLeave={() => setHoveredOrderId(null)}
                  className={`pt-2 first:pt-0 p-2.5 rounded-xl transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-blue-950/60 border-blue-500/50 shadow-md shadow-blue-500/10'
                      : 'border-transparent hover:bg-slate-800/60 hover:border-slate-700/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs text-slate-100 flex items-center gap-1">
                      <span>#{pt.orderNumber}</span>
                      <span className="text-[10px] font-normal text-slate-400">({pt.customerName})</span>
                    </span>
                    <span className="text-[10px] font-mono font-extrabold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                      {pt.roadKm} ק"מ
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-400 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <MapPin className="h-3 w-3 text-rose-400 shrink-0" />
                      <span className="truncate">{pt.deliveryAddress}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="flex items-center gap-1 text-slate-400">
                        <Warehouse className="h-3 w-3 text-blue-400" />
                        <span>{pt.warehouse}</span>
                      </span>
                      <span className={`px-1.5 py-0.2 rounded font-extrabold border text-[9px] ${getStatusBadge(pt.status).classes}`}>
                        {getStatusBadge(pt.status).label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Panel Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-[10px] text-slate-500 flex items-center justify-between">
          <span>SabanOS Logistics Map</span>
          <span className="text-slate-400 font-mono">v2.4 Live</span>
        </div>
      </div>

    </div>
  );
}
