import { Order, OrderItem, OrderStatus, AppConfig, MetricSummary, AuditLogEntry } from '../types';

/**
 * הכתובת המאוחדת של ה-Google Apps Script (נתיב הייצור הפעיל)
 */
export const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwJGML9egm2-JKh1sh0UhLI-oCev1_Ek07eWJg77PqrKZLmeOYXBSJK_udoD3Tk5VM-CA/exec";

/**
 * קטלוג מוצרים רשמי עבור המערכת
 */
export const MOCK_PRODUCTS = [
  { sku: 'SBN-PL-01', name: 'משטח עץ אירופאי תקני', price: 85, nameEn: 'Standard Euro Wooden Pallet' },
  { sku: 'SBN-ST-05', name: 'גליל ניילון נצמד 2.8 ק"ג', price: 42, nameEn: 'Stretch Wrap Roll 2.8kg' },
  { sku: 'SBN-TP-12', name: 'סרט הדבקה אקרילי חום (שלישייה)', price: 18, nameEn: 'Acrylic Brown Tape (3-Pack)' },
  { sku: 'SBN-BB-08', name: 'גליל פצפץ לעטיפה 50 ס"מ / 50 מ\'', price: 65, nameEn: 'Bubble Wrap Roll 50cm / 50m' },
  { sku: 'SBN-ST-22', name: 'סרט קשירה פוליפרופילן PP', price: 120, nameEn: 'Polypropylene PP Strapping Band' },
  { sku: 'SBN-LB-40', name: 'גליל מדבקות טרמיות 100x150', price: 35, nameEn: 'Thermal Labels Roll 100x150' },
  { sku: 'SBN-BX-10', name: 'מארז 25 קרטוני דו-גל 40x30x30', price: 95, nameEn: '25-Pack Double-Wall Box 40x30x30' },
  { sku: 'SBN-CN-03', name: 'פינות קרטון קשיחות להגנה (מארז 50)', price: 110, nameEn: 'Rigid Edge Protectors (50-Pack)' },
];

/**
 * מילון תרגומים קבוע עבור רכיבי הממשק (בנקודות קצה וכתובות)
 */
export const TRANSLATIONS_MAP: Record<string, string> = {
  'מחסן החרש': 'HaCharash Warehouse',
  'מחסן התלמיד': 'HaTalmid Warehouse',
  'מחסן שוהם לוגיסטיקה': 'Shoham Logistics Hub',
  'מחסן קיסריה צפון': 'Caesarea North Hub',
  'שופרסל בע"מ': 'Shufersal Ltd',
  'רמי לוי שיווק השקמה': 'Rami Levy Hashikma',
  'יוחננוף סופרשוק': 'Yohananof Supermarkets',
  'מחסני השוק בע"מ': 'Machsanei HaShuk',
  'ויקטורי רשת סופרמרקטים': 'Victory Supermarkets',
  'יינות ביתן והתחנות': 'Yenot Bitan',
  'חצי חינם סחר': 'Hazi Hinam Trade',
  'דואר ישראל - מרכז מיון': 'Israel Post Sorting Hub',
};

export function translate(text: string, toLang: 'he' | 'en'): string {
  if (toLang === 'he') return text;
  return TRANSLATIONS_MAP[text] || text;
}

export function formatDate(isoString: string, lang: 'he' | 'en'): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;

  if (lang === 'he') {
    return date.toLocaleDateString('he-IL', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}

const STORAGE_CONFIG_KEY = 'sabanos_config_v1';

export function getStoredConfig(): AppConfig {
  const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
  if (saved) {
    try {
      const config = JSON.parse(saved);
      return {
        webappUrl: config.webappUrl || WEBAPP_URL,
        mode: 'live',
      };
    } catch (e) {}
  }
  return {
    webappUrl: WEBAPP_URL,
    mode: 'live',
  };
}

export function saveStoredConfig(config: AppConfig): void {
  const forcedConfig = { ...config, mode: 'live' as const };
  localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(forcedConfig));
}

/**
 * משיכת הזמנות אמת ישירות משרת גוגל בלבד (ללא לוקאל וללא דמה)
 */
export async function getStoredOrders(): Promise<Order[]> {
  return await fetchLiveOrders();
}

export function saveStoredOrders(orders: Order[]): void {}

export function getStoredAuditLogs(currentOrders?: Order[]): AuditLogEntry[] {
  const saved = localStorage.getItem('sabanos_audit_logs_v1');
  return saved ? JSON.parse(saved) : [];
}

export function saveStoredAuditLogs(logs: AuditLogEntry[]): void {
  localStorage.setItem('sabanos_audit_logs_v1', JSON.stringify(logs));
}

export function createRandomOrder(lastOrderNum: string): Order {
  const nextNum = parseInt(lastOrderNum.replace('SBN-', '')) + 1 || 10001;
  return {
    id: `ord-${Date.now()}`,
    orderNumber: `SBN-${nextNum}`,
    timestamp: new Date().toISOString(),
    customerName: 'לקוח חדש',
    warehouse: 'מחסן החרש',
    deliveryAddress: 'הוראה ידנית מהמערכת',
    items: [],
    status: 'pending',
    totalAmount: 0,
    notes: 'הזמנה ידנית חלקה',
  };
}

export function parseItemsString(itemsStr: string, orderIdx: number): OrderItem[] {
  if (!itemsStr) return [];
  
  const lines = itemsStr.split(/[\n\r;]+/).map(line => line.trim()).filter(line => line.length > 0);
  
  return lines.map((line, itemIdx) => {
    let sku = 'SBN-GEN-99';
    let name = line;
    let quantity = 1;
    
    const skuMatch = line.match(/^\[([^\]]+)\]/);
    if (skuMatch) {
      sku = skuMatch[1].trim();
      name = line.substring(skuMatch[0].length).trim();
    }
    
    const qtyMatch = name.match(/(?:\s*[-xX:]\s*|\s+)(\d+)\s*$/);
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1], 10) || 1;
      name = name.substring(0, qtyMatch.index).trim();
    }
    
    name = name.replace(/^[-:\s]+|[-:\s]+$/g, '').trim();
    
    const matchingProduct = MOCK_PRODUCTS.find(p => p.sku.toLowerCase() === sku.toLowerCase() || p.name === name);
    const finalName = matchingProduct?.name || name;
    const finalPrice = matchingProduct?.price || 50;
    
    return {
      id: `item-${orderIdx}-${itemIdx}-${sku}`,
      sku,
      name: finalName || 'פריט לוגיסטי',
      price: finalPrice,
      quantity,
    };
  });
}

export function extractSpreadsheetId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9-_]{40,}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export function parseCSV(csvText: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(current);
        current = '';
      } else if (char === '\r' || char === '\n') {
        row.push(current);
        current = '';
        if (row.length > 1 || row[0] !== '') {
          result.push(row);
        }
        row = [];
        if (char === '\r' && nextChar === '\n') i++;
      } else {
        current += char;
      }
    }
  }
  if (row.length > 0 || current !== '') {
    row.push(current);
    result.push(row);
  }
  return result;
}

/**
 * Fetch live spreadsheet data via Google Apps Script WebApp - Direct Line
 */
export async function fetchLiveOrders(webappUrl?: string): Promise<Order[]> {
  const targetUrl = webappUrl || WEBAPP_URL;
  
  try {
    const response = await fetch(`${targetUrl}?action=getOrders`);
    if (!response.ok) {
      throw new Error(`Google Sheets WebApp returned HTTP ${response.status}`);
    }
    const json = await response.json();
    
    if (json && json.success === false) {
      throw new Error(json.error || "Failed to fetch orders");
    }

    const rawList = json && Array.isArray(json.data) ? json.data : [];

    return rawList.map((row: any, idx: number) => {
      const orderNumber = String(row.orderNumber || row.orderNo || `SBN-${10000 + idx}`).trim();
      const timestamp = row.timestamp ? new Date(row.timestamp).toISOString() : new Date().toISOString();
      const customerName = String(row.customerName || row.customer || 'לקוח לא ידוע').trim();
      const warehouse = String(row.warehouse || 'מחסן החרש').trim();
      const deliveryAddress = String(row.deliveryAddress || row.address || '').trim();
      const itemsRaw = String(row.items || row.itemsString || '').trim();
      const statusRaw = String(row.status || 'pending').trim().toLowerCase();
      const modelUsed = String(row.modelUsed || row.model || '').trim();
      const tokens = Number(row.tokens) || 0;
      const messageId = String(row.messageId || '').trim();
      const latitude = row.latitude ? Number(row.latitude) : undefined;
      const longitude = row.longitude ? Number(row.longitude) : undefined;

      const status = ['pending', 'processing', 'delivered', 'cancelled'].includes(statusRaw) 
        ? (statusRaw as OrderStatus) 
        : 'pending';

      const items = parseItemsString(itemsRaw, idx);
      const totalAmount = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

      return {
        id: `live-${idx}-${orderNumber}`,
        orderNumber,
        timestamp,
        customerName,
        warehouse,
        deliveryAddress,
        items,
        itemsRawString: itemsRaw,
        status,
        totalAmount,
        modelUsed,
        tokens,
        messageId,
        latitude,
        longitude
      };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  } catch (error) {
    console.error('Failed to fetch live orders:', error);
    throw error;
  }
}

/**
 * Update order status directly in the Google Sheet via Apps Script WebApp
 */
export async function updateLiveOrderStatus(webappUrl: string | undefined, orderNumber: string, status: OrderStatus): Promise<boolean> {
  const targetUrl = webappUrl || WEBAPP_URL;
  
  try {
    const response = await fetch(`${targetUrl}?action=updateStatus&orderNumber=${encodeURIComponent(orderNumber)}&status=${encodeURIComponent(status)}`);
    if (!response.ok) {
      throw new Error(`WebApp status update returned HTTP ${response.status}`);
    }
    const json = await response.json();
    return json && json.success === true;
  } catch (err) {
    console.error('Failed to update live order status:', err);
    return false;
  }
}

/**
 * חישוב מדדי אמת מהגיליון החי בלבד
 */
export function computeMetrics(orders: Order[]): MetricSummary {
  const activeWarehouses = new Set(orders.map(o => o.warehouse)).size;
  const pendingDeliveries = orders.filter(o => o.status === 'pending' || o.status === 'processing').length;
  const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
  const totalRevenue = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((acc, o) => acc + o.totalAmount, 0);

  const skuCounts: Record<string, number> = {};
  orders.forEach(o => {
    if (o.status !== 'cancelled') {
      o.items.forEach(item => {
        skuCounts[item.name] = (skuCounts[item.name] || 0) + item.quantity;
      });
    }
  });

  let topSkuName = 'אין נתונים';
  let topSkuQty = 0;
  Object.entries(skuCounts).forEach(([name, qty]) => {
    if (qty > topSkuQty) {
      topSkuName = name;
      topSkuQty = qty;
    }
  });

  return {
    totalOrders: orders.length,
    totalRevenue,
    activeWarehouses,
    pendingDeliveries,
    deliveredOrders,
    topSku: { name: topSkuName, quantity: topSkuQty },
  };
}
