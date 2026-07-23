export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  sku: string;
}

export type OrderStatus = 'pending' | 'processing' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  orderNumber: string;
  timestamp: string;
  customerName: string;
  warehouse: string;
  deliveryAddress: string;
  items: OrderItem[];
  itemsRawString?: string;
  status: OrderStatus;
  notes?: string;
  totalAmount: number;
  modelUsed?: string;
  tokens?: number;
  messageId?: string;
  latitude?: number;
  longitude?: number;
  driverName?: string;
  noaAnalysis?: string;
  depositBales?: number;
  depositPallets?: number;
  depositDrums?: number;
  depositBlockPallets?: number;
  depositStatusBags?: string;
  depositStatusPallets?: string;
  signatureDetected?: boolean;
  ptoCorrelated?: boolean;
  ptoDuration?: number;
  deliveryDiscrepancy?: string;
  splitCompleted?: boolean;
}

export interface MetricSummary {
  totalOrders: number;
  totalRevenue: number;
  activeWarehouses: number;
  pendingDeliveries: number;
  deliveredOrders: number;
  topSku: { name: string; quantity: number };
}

export type Language = 'he' | 'en';

export interface AppConfig {
  webappUrl: string;
  mode: 'mock' | 'live';
}

export interface AuditLogEntry {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  oldStatus: OrderStatus | 'created';
  newStatus: OrderStatus;
  timestamp: string;
  updatedBy: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet?: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  body?: string;
  hasAttachments?: boolean;
}


