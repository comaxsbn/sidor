import { Order, OrderItem, OrderStatus, AppConfig } from '../types';

/**
 * הכתובת המאוחדת של ה-Google Apps Script
 */
export const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwJGML9egm2-JKh1sh0UhLI-oCev1_Ek07eWJg77PqrKZLmeOYXBSJK_udoD3Tk5VM-CA/exec";

/**
 * מילון תרגומים קבוע עבור רכיבי הממשק
 */
export const TRANSLATIONS_MAP: Record<string, string> = {
  'מחסן החרש': 'HaCharash Warehouse',
  'מחסן התלמיד': 'HaTalmid Warehouse',
};

/**
 * פונקציית תרגום פשוטה
 */
export function translate(text: string, toLang: 'he' | 'en'): string {
  if (toLang === 'he') return text;
  return TRANSLATIONS_MAP[text] || text;
}

/**
 * פורמטר תאריכים מותאם שפה
 */
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

/**
 * Utility for parsing items string: "[SKU] Name - Qty"
 */
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
    
    return {
      id: `item-${orderIdx}-${itemIdx}-${sku}`,
      sku,
      name: name || 'פריט לוגיסטי',
      price: 50,
      quantity,
    };
  });
}

/**
 * Fetch live spreadsheet data via Google Apps Script WebApp
 */
export async function fetchLiveOrders(): Promise<Order[]> {
  try {
    const response = await fetch(`${WEBAPP_URL}?action=getOrders`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const json = await response.json();
    
    if (json.success === false) {
      throw new Error(json.error || "Failed to fetch data");
    }

    return json.data.map((item: any, idx: number) => ({
      id: `live-${idx}-${item.orderNumber}`,
      orderNumber: String(item.orderNumber),
      timestamp: item.timestamp,
      customerName: item.customerName,
      warehouse: item.warehouse,
      deliveryAddress: item.deliveryAddress,
      items: parseItemsString(item.items, idx),
      status: item.status as OrderStatus,
      totalAmount: 0, 
      messageId: item.messageId
    })).sort((a: Order, b: Order) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  } catch (error) {
    console.error('Failed to fetch live orders:', error);
    throw error;
  }
}

/**
 * Update order status directly in the Google Sheet via Apps Script WebApp
 */
export async function updateLiveOrderStatus(orderNumber: string, status: OrderStatus): Promise<boolean> {
  try {
    const response = await fetch(`${WEBAPP_URL}?action=updateStatus&orderNumber=${encodeURIComponent(orderNumber)}&status=${encodeURIComponent(status)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const json = await response.json();
    return json.success === true;
  } catch (err) {
    console.error('Failed to update live order status:', err);
    return false;
  }
}

/**
 * תאימות עבור פונקציות ניהול הגדרות היסטוריות ב-App.tsx
 */
export function getStoredConfig(): AppConfig {
  return {
    webappUrl: WEBAPP_URL,
    mode: 'live'
  };
}

export function saveStoredConfig(config: AppConfig): void {
  console.log("Forcing production stream config to live mode:", config);
}

/**
 * תאימות עבור פונקציות ניהול הזמנות היסטוריות ב-App.tsx
 */
export async function getStoredOrders(): Promise<Order[]> {
  return await fetchLiveOrders();
}

export function saveStoredOrders(orders: Order[]): void {
  // שמירה שקטה ללא השפעה על הזרם החי
}

/**
 * תאימות עבור פונקציות ניהול לוגים היסטוריות ב-App.tsx
 */
