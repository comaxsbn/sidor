import { Order, OrderItem, OrderStatus, AppConfig, AuditLogEntry } from '../types';

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
      price: 50, // Default fallback price
      quantity,
    };
  });
}

/**
 * Fetch live spreadsheet data via Google Apps Script WebApp
 */
export async function fetchLiveOrders(): Promise<Order[]> {
  const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwJGML9egm2-JKh1sh0UhLI-oCev1_Ek07eWJg77PqrKZLmeOYXBSJK_udoD3Tk5VM-CA/exec";
  
  try {
    const response = await fetch(`${WEBAPP_URL}?action=getOrders`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const json = await response.json();
    
    if (json.success === false) {
      throw new Error(json.error || "Failed to fetch data");
    }

    // Map the raw data from Google Sheets to the Order type
    return json.data.map((item: any, idx: number) => ({
      id: `live-${idx}-${item.orderNumber}`,
      orderNumber: String(item.orderNumber),
      timestamp: item.timestamp,
      customerName: item.customerName,
      warehouse: item.warehouse,
      deliveryAddress: item.deliveryAddress,
      items: parseItemsString(item.items, idx),
      status: item.status as OrderStatus,
      totalAmount: 0, // Should be calculated or returned by API
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
  const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbztycOyLLcQe9cOAtrtsrEg8zCe7F39CXWgQ2wWoAPuGlhD6CNVDaWNzEiNM0vjzQALsw/exec";
  
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

export function getStoredConfig(): AppConfig {
  return {
    webappUrl: "https://script.google.com/macros/s/AKfycbztycOyLLcQe9cOAtrtsrEg8zCe7F39CXWgQ2wWoAPuGlhD6CNVDaWNzEiNM0vjzQALsw/exec",
    mode: 'live'
  };
}
