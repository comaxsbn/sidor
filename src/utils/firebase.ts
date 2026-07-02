import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  query, 
  orderBy, 
  writeBatch,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { Order, AuditLogEntry } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Connect to the specific database instance provisioned for this applet
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

// Reference to collections
const ORDERS_COLLECTION = 'orders';
const AUDIT_LOGS_COLLECTION = 'auditLogs';

// Helper to safely get timestamp value for sorting, preventing RangeError or NaN crashes
const safeGetTime = (timestamp: any): number => {
  if (!timestamp) return 0;
  try {
    const d = new Date(timestamp);
    const time = d.getTime();
    return isNaN(time) ? 0 : time;
  } catch {
    return 0;
  }
};

/**
 * Fetch all orders from Firebase Firestore, sorted by timestamp descending
 */
export async function getOrdersFromFirestore(): Promise<Order[]> {
  try {
    const ordersCol = collection(db, ORDERS_COLLECTION);
    const q = query(ordersCol);
    const snapshot = await getDocs(q);
    const ordersList: Order[] = [];
    
    snapshot.forEach((docSnap) => {
      ordersList.push({ id: docSnap.id, ...docSnap.data() } as Order);
    });
    
    // Sort descending by timestamp safely
    return ordersList.sort((a, b) => safeGetTime(b.timestamp) - safeGetTime(a.timestamp));
  } catch (error) {
    console.error('Error fetching orders from Firestore:', error);
    throw error;
  }
}

/**
 * Save/update a single order in Firestore
 */
export async function saveOrderToFirestore(order: Order): Promise<void> {
  try {
    const orderRef = doc(db, ORDERS_COLLECTION, order.id);
    await setDoc(orderRef, order, { merge: true });
    console.log(`Successfully saved order ${order.orderNumber} to Firestore.`);
  } catch (error) {
    console.error(`Error saving order ${order.id} to Firestore:`, error);
    throw error;
  }
}

/**
 * Save multiple orders to Firestore in batches (efficient for syncing)
 */
export async function syncOrdersToFirestore(orders: Order[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    orders.forEach((order) => {
      const orderRef = doc(db, ORDERS_COLLECTION, order.id);
      batch.set(orderRef, order, { merge: true });
    });
    await batch.commit();
    console.log(`Successfully synced ${orders.length} orders to Firestore.`);
  } catch (error) {
    console.error('Error syncing orders to Firestore:', error);
    throw error;
  }
}

/**
 * Delete a single order from Firestore
 */
export async function deleteOrderFromFirestore(orderId: string): Promise<void> {
  try {
    const orderRef = doc(db, ORDERS_COLLECTION, orderId);
    await deleteDoc(orderRef);
    console.log(`Successfully deleted order ${orderId} from Firestore.`);
  } catch (error) {
    console.error(`Error deleting order ${orderId} from Firestore:`, error);
    throw error;
  }
}

/**
 * Fetch all status audit logs from Firebase Firestore
 */
export async function getAuditLogsFromFirestore(): Promise<AuditLogEntry[]> {
  try {
    const logsCol = collection(db, AUDIT_LOGS_COLLECTION);
    const q = query(logsCol);
    const snapshot = await getDocs(q);
    const logsList: AuditLogEntry[] = [];
    
    snapshot.forEach((docSnap) => {
      logsList.push({ id: docSnap.id, ...docSnap.data() } as AuditLogEntry);
    });
    
    // Sort descending by timestamp safely
    return logsList.sort((a, b) => safeGetTime(b.timestamp) - safeGetTime(a.timestamp));
  } catch (error) {
    console.error('Error fetching audit logs from Firestore:', error);
    throw error;
  }
}

/**
 * Save a single audit log entry in Firestore
 */
export async function saveAuditLogToFirestore(log: AuditLogEntry): Promise<void> {
  try {
    const logRef = doc(db, AUDIT_LOGS_COLLECTION, log.id);
    await setDoc(logRef, log);
    console.log(`Successfully saved audit log ${log.id} to Firestore.`);
  } catch (error) {
    console.error(`Error saving audit log ${log.id} to Firestore:`, error);
    throw error;
  }
}

/**
 * Save multiple audit logs to Firestore in batches
 */
export async function syncAuditLogsToFirestore(logs: AuditLogEntry[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    logs.forEach((log) => {
      const logRef = doc(db, AUDIT_LOGS_COLLECTION, log.id);
      batch.set(logRef, log, { merge: true });
    });
    await batch.commit();
    console.log(`Successfully synced ${logs.length} audit logs to Firestore.`);
  } catch (error) {
    console.error('Error syncing audit logs to Firestore:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time changes of orders collection in Firestore
 */
export function subscribeToOrders(
  onUpdate: (orders: Order[]) => void, 
  onError: (err: Error) => void
): () => void {
  const ordersCol = collection(db, ORDERS_COLLECTION);
  const q = query(ordersCol);
  return onSnapshot(q, (snapshot) => {
    const ordersList: Order[] = [];
    snapshot.forEach((docSnap) => {
      ordersList.push({ id: docSnap.id, ...docSnap.data() } as Order);
    });
    // Sort descending by timestamp safely
    const sorted = ordersList.sort((a, b) => safeGetTime(b.timestamp) - safeGetTime(a.timestamp));
    onUpdate(sorted);
  }, onError);
}

/**
 * Subscribe to real-time changes of audit logs collection in Firestore
 */
export function subscribeToAuditLogs(
  onUpdate: (logs: AuditLogEntry[]) => void, 
  onError: (err: Error) => void
): () => void {
  const logsCol = collection(db, AUDIT_LOGS_COLLECTION);
  const q = query(logsCol);
  return onSnapshot(q, (snapshot) => {
    const logsList: AuditLogEntry[] = [];
    snapshot.forEach((docSnap) => {
      logsList.push({ id: docSnap.id, ...docSnap.data() } as AuditLogEntry);
    });
    // Sort descending by timestamp safely
    const sorted = logsList.sort((a, b) => safeGetTime(b.timestamp) - safeGetTime(a.timestamp));
    onUpdate(sorted);
  }, onError);
}
