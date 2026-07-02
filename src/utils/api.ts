export async function fetchLiveOrders(): Promise<Order[]> {
  const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzePA9xrSAV8gPu_rAKHrnhZ3qoXCq4MaFIA9BO1OP5RGgLw206zBQpHFMfq9YmnzqakA/exec";
  
  // שימוש ב-Proxy שהגדרנו ב-netlify.toml כדי לעקוף חסימות דפדפן
  const response = await fetch(`/api/orders?webappUrl=${encodeURIComponent(WEBAPP_URL)}&action=getOrders`);
  
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  
  const json = await response.json();
  if (!json.success) throw new Error(json.error || "Failed to fetch orders");

  return json.data.map((item: any) => ({
    id: `live-${item.orderNumber}`,
    orderNumber: item.orderNumber,
    timestamp: item.timestamp,
    customerName: item.customerName,
    warehouse: item.warehouse,
    deliveryAddress: item.deliveryAddress,
    items: parseItemsString(item.items, 0), // משתמש ב-Parser הקיים שלך
    status: item.status as OrderStatus,
    totalAmount: 0 // תוסיף כאן לוגיקת חישוב אם נדרש
  }));
}
