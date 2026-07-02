import { Order, OrderItem, OrderStatus, AppConfig, MetricSummary, AuditLogEntry } from '../types';

// Default mock items for SabanOS Logistics
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

const MOCK_CUSTOMERS = [
  { name: 'שופרסל בע"מ', nameEn: 'Shufersal Ltd' },
  { name: 'רמי לוי שיווק השקמה', nameEn: 'Rami Levy Hashikma' },
  { name: 'יוחננוף סופרשוק', nameEn: 'Yohananof Supermarkets' },
  { name: 'מחסני השוק בע"מ', nameEn: 'Machsanei HaShuk' },
  { name: 'ויקטורי רשת סופרמרקטים', nameEn: 'Victory Supermarkets' },
  { name: 'יינות ביתן והתחנות', nameEn: 'Yenot Bitan' },
  { name: 'חצי חינם סחר', nameEn: 'Hazi Hinam Trade' },
  { name: 'דואר ישראל - מרכז מיון', nameEn: 'Israel Post Sorting Hub' },
];

const MOCK_ADDRESSES = [
  { address: 'החרש 14, אזור התעשייה תל אביב', addressEn: '14 HaCharash St, Tel Aviv Industrial Zone' },
  { address: 'התלמיד 5, אזור תעשייה עטרות, ירושלים', addressEn: '5 HaTalmid St, Atarot Industrial Zone, Jerusalem' },
  { address: 'דרך השלום 42, פארק המדע חיפה', addressEn: '42 Derech HaShalom, Haifa Science Park' },
  { address: 'האורגים 8, אזור התעשייה אשדוד', addressEn: '8 HaOregim St, Ashdod Industrial Zone' },
  { address: 'התעשייה 21, עמק שרה, באר שבע', addressEn: '21 HaTaasiya St, Emek Sara, Beer Sheva' },
  { address: 'שדרות המקצועות 12, מודיעין פארק טכנולוגי', addressEn: '12 Sderot HaMikzoat, Modiin Tech Park' },
  { address: 'הרצל 105, ראשון לציון', addressEn: '105 Herzl St, Rishon LeZion' },
  { address: 'המסגר 9, חולון אזור תעשייה', addressEn: '9 HaMasgar St, Holon Industrial Zone' },
];

const MOCK_WAREHOUSES = [
  { he: 'מחסן החרש', en: 'HaCharash Warehouse' },
  { he: 'מחסן התלמיד', en: 'HaTalmid Warehouse' },
  { he: 'מחסן שוהם לוגיסטיקה', en: 'Shoham Logistics Hub' },
  { he: 'מחסן קיסריה צפון', en: 'Caesarea North Hub' },
];

// Helper to generate random date in the last 7 days
function getRandomTimestamp(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  // Random hour during business day
  date.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0);
  return date.toISOString();
}

// Generate highly realistic mock orders
export function generateMockOrders(): Order[] {
  const orders: Order[] = [];
  const totalMockOrders = 28;

  for (let i = 0; i < totalMockOrders; i++) {
    const custIndex = Math.floor(Math.random() * MOCK_CUSTOMERS.length);
    const addrIndex = Math.floor(Math.random() * MOCK_ADDRESSES.length);
    const whIndex = Math.floor(Math.random() * MOCK_WAREHOUSES.length);
    
    // Determine days ago to distribute orders chronologically
    const daysAgo = Math.floor(i / 4); 
    const timestamp = getRandomTimestamp(daysAgo);

    // Generate random items
    const numItems = 1 + Math.floor(Math.random() * 4);
    const orderItems: OrderItem[] = [];
    const usedIndices = new Set<number>();
    
    while (orderItems.length < numItems) {
      const prodIndex = Math.floor(Math.random() * MOCK_PRODUCTS.length);
      if (!usedIndices.has(prodIndex)) {
        usedIndices.add(prodIndex);
        const prod = MOCK_PRODUCTS[prodIndex];
        const qty = 1 + Math.floor(Math.random() * 40) * (prodIndex === 0 || prodIndex === 6 ? 1 : 3); // higher qty for smaller items
        orderItems.push({
          id: `item-${i}-${prodIndex}`,
          sku: prod.sku,
          name: prod.name, // Will translate dynamically in components if needed, or keep dual bilingual
          price: prod.price,
          quantity: qty,
        });
      }
    }

    const totalAmount = orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    
    // Status distribution
    let status: OrderStatus = 'delivered';
    if (daysAgo === 0) {
      const rand = Math.random();
      status = rand < 0.4 ? 'pending' : rand < 0.8 ? 'processing' : 'delivered';
    } else if (daysAgo === 1) {
      status = Math.random() < 0.2 ? 'processing' : Math.random() < 0.05 ? 'cancelled' : 'delivered';
    } else {
      status = Math.random() < 0.05 ? 'cancelled' : 'delivered';
    }

    const orderNo = `SBN-${10000 + (totalMockOrders - i)}`;

    orders.push({
      id: `ord-${10000 + i}`,
      orderNumber: orderNo,
      timestamp,
      customerName: MOCK_CUSTOMERS[custIndex].name, // Keep Hebrew in data as primary, translation maps in config
      warehouse: MOCK_WAREHOUSES[whIndex].he,
      deliveryAddress: MOCK_ADDRESSES[addrIndex].address,
      items: orderItems,
      status,
      totalAmount,
      notes: Math.random() < 0.3 ? (whIndex === 0 ? 'פריקה עם רמפה בלבד' : 'נא לתאם מראש בטלפון') : undefined,
    });
  }

  return orders.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// Config management
const STORAGE_CONFIG_KEY = 'sabanos_config_v1';
const STORAGE_ORDERS_KEY = 'sabanos_orders_v1';

export function getStoredConfig(): AppConfig {
  const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbwPfd6hqf62ZqlW-1wVSjNEQRXgLlEkGKEKB6xoHhsgE_w_4Rj8Pbht-6KQl3L3ZDHBTg/exec';
  const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
  if (saved) {
    try {
      const config = JSON.parse(saved);
      return {
        webappUrl: config.webappUrl || DEFAULT_URL,
        mode: 'live', // Lock to live production stream
      };
    } catch (e) {
      // fallback
    }
  }
  return {
    webappUrl: DEFAULT_URL,
    mode: 'live', // Lock to live production stream
  };
}

export function saveStoredConfig(config: AppConfig): void {
  // Ensure mode is always saved as live
  const forcedConfig = { ...config, mode: 'live' as const };
  localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(forcedConfig));
}

export function getStoredOrders(): Order[] {
  const saved = localStorage.getItem(STORAGE_ORDERS_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as Order[];
      return parsed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (e) {
      // fallback
    }
  }
  
  // Initialize with generateMockOrders and save
  const mock = generateMockOrders();
  const sortedMock = mock.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(sortedMock));
  return sortedMock;
}

export function saveStoredOrders(orders: Order[]): void {
  localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(orders));
}

const STORAGE_AUDIT_LOGS_KEY = 'sabanos_audit_logs_v1';

export function getStoredAuditLogs(currentOrders?: Order[]): AuditLogEntry[] {
  const saved = localStorage.getItem(STORAGE_AUDIT_LOGS_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      // fallback
    }
  }

  // Generate realistic initial logs from current orders if not provided
  const orders = currentOrders || getStoredOrders();
  const logs: AuditLogEntry[] = [];
  
  // Sort orders so we generate historic logs sequentially
  const sorted = [...orders].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  sorted.forEach((order) => {
    const baseTime = new Date(order.timestamp);
    
    // Creation log
    logs.push({
      id: `audit-${order.id}-created`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      oldStatus: 'created',
      newStatus: 'pending',
      timestamp: baseTime.toISOString(),
      updatedBy: 'System'
    });

    if (order.status === 'processing' || order.status === 'delivered') {
      const procTime = new Date(baseTime.getTime() + 45 * 60 * 1000); // +45 mins
      logs.push({
        id: `audit-${order.id}-processing`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        oldStatus: 'pending',
        newStatus: 'processing',
        timestamp: procTime.toISOString(),
        updatedBy: 'Warehouse Agent'
      });
    }

    if (order.status === 'delivered') {
      const delivTime = new Date(baseTime.getTime() + 180 * 60 * 1000); // +3 hours
      logs.push({
        id: `audit-${order.id}-delivered`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        oldStatus: 'processing',
        newStatus: 'delivered',
        timestamp: delivTime.toISOString(),
        updatedBy: 'Noa AI'
      });
    }

    if (order.status === 'cancelled') {
      const cancelTime = new Date(baseTime.getTime() + 120 * 60 * 1000); // +2 hours
      logs.push({
        id: `audit-${order.id}-cancelled`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        oldStatus: 'pending',
        newStatus: 'cancelled',
        timestamp: cancelTime.toISOString(),
        updatedBy: 'Manager'
      });
    }
  });

  // Sort logs by timestamp descending so the newest audit is first
  const sortedLogs = logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  localStorage.setItem(STORAGE_AUDIT_LOGS_KEY, JSON.stringify(sortedLogs));
  return sortedLogs;
}

export function saveStoredAuditLogs(logs: AuditLogEntry[]): void {
  localStorage.setItem(STORAGE_AUDIT_LOGS_KEY, JSON.stringify(logs));
}


// Map english translations for UI
export const TRANSLATIONS_MAP: Record<string, string> = {
  // Warehouses
  'מחסן החרש': 'HaCharash Warehouse',
  'מחסן התלמיד': 'HaTalmid Warehouse',
  'מחסן שוהם לוגיסטיקה': 'Shoham Logistics Hub',
  'מחסן קיסריה צפון': 'Caesarea North Hub',

  // Customers
  'שופרסל בע"מ': 'Shufersal Ltd',
  'רמי לוי שיווק השקמה': 'Rami Levy Hashikma',
  'יוחננוף סופרשוק': 'Yohananof Supermarkets',
  'מחסני השוק בע"מ': 'Machsanei HaShuk',
  'ויקטורי רשת סופרמרקטים': 'Victory Supermarkets',
  'יינות ביתן והתחנות': 'Yenot Bitan',
  'חצי חינם סחר': 'Hazi Hinam Trade',
  'דואר ישראל - מרכז מיון': 'Israel Post Sorting Hub',

  // Addresses
  'החרש 14, אזור התעשייה תל אביב': '14 HaCharash St, Tel Aviv Industrial Zone',
  'התלמיד 5, אזור תעשייה עטרות, ירושלים': '5 HaTalmid St, Atarot Industrial Zone, Jerusalem',
  'דרך השלום 42, פארק המדע חיפה': '42 Derech HaShalom, Haifa Science Park',
  'האורגים 8, אזור התעשייה אשדוד': '8 HaOregim St, Ashdod Industrial Zone',
  'התעשייה 21, עמק שרה, באר שבע': '21 HaTaasiya St, Emek Sara, Beer Sheva',
  'שדרות המקצועות 12, מודיעין פארק טכנולוגי': '12 Sderot HaMikzoat, Modiin Tech Park',
  'הרצל 105, ראשון לציון': '105 Herzl St, Rishon LeZion',
  'המסגר 9, חולון אזור תעשייה': '9 HaMasgar St, Holon Industrial Zone',

  // Products
  'משטח עץ אירופאי תקני': 'Standard Euro Wooden Pallet',
  'גליל ניילון נצמד 2.8 ק"ג': 'Stretch Wrap Roll 2.8kg',
  'סרט הדבקה אקרילי חום (שלישייה)': 'Acrylic Brown Tape (3-Pack)',
  'גליל פצפץ לעטיפה 50 ס"מ / 50 מ\'': 'Bubble Wrap Roll 50cm / 50m',
  'סרט קשירה פוליפרופילן PP': 'Polypropylene PP Strapping Band',
  'גליל מדבקות טרמיות 100x150': 'Thermal Labels Roll 100x150',
  'מארז 25 קרטוני דו-גל 40x30x30': '25-Pack Double-Wall Box 40x30x30',
  'פינות קרטון קשיחות להגנה (מארז 50)': 'Rigid Edge Protectors (50-Pack)',
};

// Function to translate a value
export function translate(text: string, toLang: 'he' | 'en'): string {
  if (toLang === 'he') return text; // Primary is already Hebrew
  return TRANSLATIONS_MAP[text] || text;
}

// Format date nicely based on language
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

// Create a single randomized new order
export function createRandomOrder(lastOrderNum: string): Order {
  const nextNum = parseInt(lastOrderNum.replace('SBN-', '')) + 1;
  const custIndex = Math.floor(Math.random() * MOCK_CUSTOMERS.length);
  const addrIndex = Math.floor(Math.random() * MOCK_ADDRESSES.length);
  const whIndex = Math.floor(Math.random() * MOCK_WAREHOUSES.length);
  const numItems = 1 + Math.floor(Math.random() * 3);
  
  const orderItems: OrderItem[] = [];
  const used = new Set<number>();
  while (orderItems.length < numItems) {
    const prodIndex = Math.floor(Math.random() * MOCK_PRODUCTS.length);
    if (!used.has(prodIndex)) {
      used.add(prodIndex);
      const prod = MOCK_PRODUCTS[prodIndex];
      orderItems.push({
        id: `item-${Date.now()}-${prodIndex}`,
        sku: prod.sku,
        name: prod.name,
        price: prod.price,
        quantity: 5 + Math.floor(Math.random() * 30),
      });
    }
  }

  const totalAmount = orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  return {
    id: `ord-${Date.now()}`,
    orderNumber: `SBN-${nextNum}`,
    timestamp: new Date().toISOString(),
    customerName: MOCK_CUSTOMERS[custIndex].name,
    warehouse: MOCK_WAREHOUSES[whIndex].he,
    deliveryAddress: MOCK_ADDRESSES[addrIndex].address,
    items: orderItems,
    status: 'pending',
    totalAmount,
    notes: Math.random() < 0.2 ? 'אספקה דחופה ביותר!' : undefined,
  };
}

/**
 * Elegant multi-line items string parser
 * Parses "[SKU] Name - Qty" format separated by newlines or semicolons
 */
export function parseItemsString(itemsStr: string, orderIdx: number): OrderItem[] {
  if (!itemsStr) return [];
  
  // Split by newline or semicolon
  const lines = itemsStr.split(/[\n\r;]+/).map(line => line.trim()).filter(line => line.length > 0);
  
  return lines.map((line, itemIdx) => {
    let sku = 'SBN-GEN-99';
    let name = line;
    let quantity = 1;
    
    // Extract SKU inside square brackets: e.g. [SBN-PL-01]
    const skuMatch = line.match(/^\[([^\]]+)\]/);
    if (skuMatch) {
      sku = skuMatch[1].trim();
      name = line.substring(skuMatch[0].length).trim();
    }
    
    // Extract quantity from ending structure, supporting: " - 15", " 15", " x15", ": 15", etc.
    const qtyMatch = name.match(/(?:\s*[-xX:]\s*|\s+)(\d+)\s*$/);
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1], 10) || 1;
      name = name.substring(0, qtyMatch.index).trim();
    }
    
    // Clean starting/trailing punctuations
    name = name.replace(/^[-:\s]+|[-:\s]+$/g, '').trim();
    
    // Enrich with exact product catalog details if they match
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

// Helper to extract Spreadsheet ID from a Google Sheets URL or ID
export function extractSpreadsheetId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9-_]{40,}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// RFC 4180-compliant state machine CSV parser
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
          i++; // skip next quote
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
        if (char === '\r' && nextChar === '\n') {
          i++; // skip \n
        }
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
 * Fetch live spreadsheet data via Google Apps Script WebApp
 */
export async function fetchLiveOrders(webappUrl?: string): Promise<Order[]> {
  const targetUrl = webappUrl || 'https://script.google.com/macros/s/AKfycbwPfd6hqf62ZqlW-1wVSjNEQRXgLlEkGKEKB6xoHhsgE_w_4Rj8Pbht-6KQl3L3ZDHBTg/exec';
  
  let rawList: any[] = [];
  try {
    // Route through server proxy to bypass browser-side CORS restriction and prevent "Failed to fetch"
    const proxyUrl = `/api/orders?webappUrl=${encodeURIComponent(targetUrl)}`;
    console.log(`Fetching orders via server-side proxy: ${proxyUrl}`);
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      try {
        const errJson = await response.json();
        if (errJson && errJson.error) {
          throw new Error(errJson.error);
        }
      } catch (parseErr) {
        // Fallback to default message below if parsing fails
      }
      throw new Error(`Google Sheets Proxy returned HTTP ${response.status}`);
    }
    const json = await response.json();
    
    if (json && json.success === false) {
      throw new Error(json.error || "Failed to fetch via proxy");
    }

    rawList = json && Array.isArray(json.data) 
      ? json.data 
      : (json && json.success && Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : (json.data || json.orders || [])));
      
    if (!Array.isArray(rawList)) {
      throw new Error('Response is not in array format');
    }

    const parsedOrders = rawList.map((row: any, idx: number) => {
      if (Array.isArray(row)) {
        // Fallback for raw double arrays [timestamp, orderNumber, customerName, warehouse, deliveryAddress, itemsRaw, statusRaw, modelUsed, tokens, messageId]
        const timestamp = row[0] ? new Date(row[0]).toISOString() : new Date().toISOString();
        const orderNumber = String(row[1] || `SBN-${10000 + idx}`).trim();
        const customerName = String(row[2] || 'לקוח לא ידוע').trim();
        const warehouse = String(row[3] || 'מחסן החרש').trim();
        const deliveryAddress = String(row[4] || '').trim();
        const itemsRaw = String(row[5] || '').trim();
        const statusRaw = String(row[6] || 'pending').trim().toLowerCase();
        const modelUsed = String(row[7] || '').trim();
        const tokens = Number(row[8]) || 0;
        const messageId = String(row[9] || '').trim();
        const latitude = row[10] ? Number(row[10]) : undefined;
        const longitude = row[11] ? Number(row[11]) : undefined;

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
          latitude: latitude && !isNaN(latitude) ? latitude : undefined,
          longitude: longitude && !isNaN(longitude) ? longitude : undefined
        };
      } else {
        // Standard typed object returned from Code.js WebApp
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
          latitude: latitude && !isNaN(latitude) ? latitude : undefined,
          longitude: longitude && !isNaN(longitude) ? longitude : undefined
        };
      }
    });

    return parsedOrders.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  } catch (error) {
    console.error('Failed to fetch live orders:', error);
    throw error;
  }
}

/**
 * Update order status directly in the Google Sheet via Apps Script WebApp
 */
export async function updateLiveOrderStatus(webappUrl: string | undefined, orderNumber: string, status: OrderStatus): Promise<boolean> {
  const targetUrl = webappUrl || 'https://script.google.com/macros/s/AKfycbwPfd6hqf62ZqlW-1wVSjNEQRXgLlEkGKEKB6xoHhsgE_w_4Rj8Pbht-6KQl3L3ZDHBTg/exec';
  if (!targetUrl) return false;
  
  try {
    // Route through server proxy to bypass browser-side CORS restrictions
    const proxyUrl = `/api/update-status?webappUrl=${encodeURIComponent(targetUrl)}&orderNumber=${encodeURIComponent(orderNumber)}&status=${encodeURIComponent(status)}`;
    console.log(`Updating status via server-side proxy: ${proxyUrl}`);
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`Proxy status update returned HTTP ${response.status}`);
    }
    const json = await response.json();
    return json && json.success === true;
  } catch (err) {
    console.error('Failed to update live order status:', err);
    return false;
  }
}

// Compute key metrics
export function computeMetrics(orders: Order[]): MetricSummary {
  const activeWarehouses = new Set(orders.map(o => o.warehouse)).size;
  const pendingDeliveries = orders.filter(o => o.status === 'pending' || o.status === 'processing').length;
  const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
  const totalRevenue = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((acc, o) => acc + o.totalAmount, 0);

  // Top SKU
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
