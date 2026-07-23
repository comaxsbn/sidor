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
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import { Order, AuditLogEntry } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Connect to the specific database instance provisioned for this applet
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || '(default)');

// Initialize Auth
export const auth = getAuth(app);

// Configure Google Auth Provider with Gmail Scopes
const provider = new GoogleAuthProvider();
provider.addScope('https://mail.google.com/');
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/gmail.modify');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

/**
 * Initializes Firebase Auth state listener and token cache
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Executes Google Sign-In with popup and caches the OAuth access token in memory
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain access token from Firebase Auth credential');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Returns the currently cached OAuth access token
 */
export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Signs out current user and clears in-memory OAuth token
 */
export const logoutUser = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};


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
 * Recursively removes all `undefined` values from an object or array
 * so that Firestore setDoc / writeBatch.set does not throw "Unsupported field value: undefined" error.
 */
function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleanObj[key] = sanitizeForFirestore(value);
      }
    }
    return cleanObj as T;
  }
  return data;
}

/**
 * Fetch all orders from Firebase Firestore, sorted by timestamp descending
 */
export async function getOrdersFromFirestore(): Promise<Order[]> {
  try {
    const ordersCol = collection(db, ORDERS_COLLECTION);
    const q = query(ordersCol);
    const snapshot = await getDocs(q);
    const ordersMap = new Map<string, Order>();
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Order;
      const finalId = docSnap.id || data.id || `doc-${Math.random().toString(36).substring(2)}`;
      ordersMap.set(finalId, { ...data, id: finalId });
    });
    
    const ordersList = Array.from(ordersMap.values());
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
    const cleanOrder = sanitizeForFirestore(order);
    await setDoc(orderRef, cleanOrder, { merge: true });
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
  if (!orders || orders.length === 0) return;
  try {
    const chunkSize = 450;
    for (let i = 0; i < orders.length; i += chunkSize) {
      const chunk = orders.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((order) => {
        const orderRef = doc(db, ORDERS_COLLECTION, order.id);
        batch.set(orderRef, sanitizeForFirestore(order), { merge: true });
      });
      await batch.commit();
    }
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
    const logsMap = new Map<string, AuditLogEntry>();
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as AuditLogEntry;
      const finalId = docSnap.id || data.id || `log-${Math.random().toString(36).substring(2)}`;
      logsMap.set(finalId, { ...data, id: finalId });
    });
    
    const logsList = Array.from(logsMap.values());
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
    const cleanLog = sanitizeForFirestore(log);
    await setDoc(logRef, cleanLog);
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
  if (!logs || logs.length === 0) return;
  try {
    const chunkSize = 450;
    for (let i = 0; i < logs.length; i += chunkSize) {
      const chunk = logs.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((log) => {
        const logRef = doc(db, AUDIT_LOGS_COLLECTION, log.id);
        batch.set(logRef, sanitizeForFirestore(log), { merge: true });
      });
      await batch.commit();
    }
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
    const ordersMap = new Map<string, Order>();
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Order;
      const finalId = docSnap.id || data.id || `doc-${Math.random().toString(36).substring(2)}`;
      ordersMap.set(finalId, { ...data, id: finalId });
    });
    const ordersList = Array.from(ordersMap.values());
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
    const logsMap = new Map<string, AuditLogEntry>();
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as AuditLogEntry;
      const finalId = docSnap.id || data.id || `log-${Math.random().toString(36).substring(2)}`;
      logsMap.set(finalId, { ...data, id: finalId });
    });
    const logsList = Array.from(logsMap.values());
    // Sort descending by timestamp safely
    const sorted = logsList.sort((a, b) => safeGetTime(b.timestamp) - safeGetTime(a.timestamp));
    onUpdate(sorted);
  }, onError);
}
